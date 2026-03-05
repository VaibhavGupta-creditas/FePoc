import secrets
import jwt
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.core import signing

logger = logging.getLogger(__name__)

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria, 
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
    ResidentKeyRequirement,
    AuthenticatorAttachment
)

class PasskeyService:
    """
    Core service for handling WebAuthn (Passkey) ceremonies.
    This class is designed to be used within any Django project.
    
    Example Usage:
    >>> service = PasskeyService()
    >>> has_key = service.check_user_has_passkeys(user)
    """
    CHALLENGE_TTL = 300 # 5 minutes

    @classmethod
    def get_setting(cls, key, default=None):
        """Resolves a setting value from settings.PASSKEY_[key]"""
        return getattr(settings, f"PASSKEY_{key}", default)

    @classmethod
    def get_nested_attr(cls, obj, attr, default=None):
        """Fetches an attribute from an object, supporting nested lookups (e.g. 'profile.auth_id')."""
        if not obj:
            return default
        for part in attr.split('.'):
            obj = getattr(obj, part, None)
            if obj is None:
                return default
        return str(obj)

    @classmethod
    def get_raw_user_id(cls, user):
        """Returns the raw unique identifier (UUID/DB ID) for WebAuthn ceremony."""
        field = cls.get_setting("USER_ID_FIELD", "id")
        return cls.get_nested_attr(user, field)

    @classmethod
    def get_user_id(cls, user):
        """Returns an encrypted/signed identifier for WebAuthn and API responses."""
        raw_id = cls.get_raw_user_id(user)
        return cls.encrypt_user_id(raw_id) if raw_id else None

    @classmethod
    def encrypt_user_id(cls, raw_id):
        """Encrypts/Signs a raw user ID."""
        return signing.dumps(raw_id, salt="passkey-user-id")

    @classmethod
    def decrypt_user_id(cls, encrypted_id):
        """Decrypts/Unsigns an identifier back to raw ID."""
        try:
            return signing.loads(encrypted_id, salt="passkey-user-id")
        except Exception:
            return None

    @classmethod
    def get_username(cls, user):
        """Returns the display name for WebAuthn (usually mobile/email)."""
        field = cls.get_setting("USERNAME_FIELD", "username")
        return cls.get_nested_attr(user, field)

    @staticmethod
    def get_rp_settings():
        """
        Fetches settings from the host Django project.
        Configure these in your settings.py (Dev/UAT/Prod).
        """
        return {
            "rp_id": getattr(settings, "PASSKEY_RP_ID", "localhost"),
            "rp_name": getattr(settings, "PASSKEY_RP_NAME", "Passkey Auth Core"),
            "origin": getattr(settings, "PASSKEY_ORIGIN", "http://localhost:8000"),
        }

    @classmethod
    def generate_registration_options(cls, user):
        """
        Generates WebAuthn registration options for a specific user.
        Stores the challenge in Django's cache for later verification.
        
        Args:
            user: The Django User model instance.
            
        Returns:
            (options, challenge_id): WebAuthn options and a unique reference id.
        """
        rp_settings = cls.get_rp_settings()
        
        logger.debug(f"Generating Registration Options for: {user.username}")
        options = generate_registration_options(
            rp_id=rp_settings["rp_id"],
            rp_name=rp_settings["rp_name"],
            user_id=cls.get_raw_user_id(user).encode(),
            user_name=cls.get_username(user),
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM, # Restrict to device sensors (Face/Fingerprint)
                user_verification=UserVerificationRequirement.REQUIRED,   # Force biometric/PIN verification
                resident_key=ResidentKeyRequirement.REQUIRED,             # Required for better discovery
                require_resident_key=True
            ),
            timeout=120000 # 2 minutes
        )
        
        challenge_id = secrets.token_urlsafe(32)
        cache.set(
            f"pk_reg_{challenge_id}", 
            {"challenge": bytes_to_base64url(options.challenge), "user_id": user.id},
            timeout=cls.CHALLENGE_TTL
        )
        
        return options, challenge_id

    @classmethod
    def verify_registration(cls, challenge_id, credential_data):
        stored_data = cache.get(f"pk_reg_{challenge_id}")
        if not stored_data:
            raise ValueError("Challenge expired or invalid")

        rp_settings = cls.get_rp_settings()
        
        verification = verify_registration_response(
            credential=credential_data,
            expected_challenge=base64url_to_bytes(stored_data["challenge"]),
            expected_origin=rp_settings["origin"],
            expected_rp_id=rp_settings["rp_id"],
        )
        
        # Cleanup
        cache.delete(f"pk_reg_{challenge_id}")
        return verification, stored_data["user_id"]

    @classmethod
    def generate_authentication_options(cls, user=None):
        rp_settings = cls.get_rp_settings()
        
        allow_credentials = []
        if user:
            from .models import PasskeyCredential
            user_credentials = PasskeyCredential.objects.filter(user=user)
            
            for cred in user_credentials:
                # Convert strings from DB back to WebAuthn Enums
                transports = []
                if cred.transports:
                    for t in cred.transports:
                        try:
                            transports.append(AuthenticatorTransport(t))
                        except ValueError:
                            continue
                
                allow_credentials.append(PublicKeyCredentialDescriptor(
                    id=base64url_to_bytes(cred.credential_id),
                    transports=transports
                ))

        options = generate_authentication_options(
            rp_id=rp_settings["rp_id"],
            allow_credentials=allow_credentials if allow_credentials else None,
            user_verification=UserVerificationRequirement.REQUIRED, # Force biometric/PIN verification during login
            timeout=120000 # 2 minutes for QR scan/mobile flow
        )
        
        challenge_id = secrets.token_urlsafe(32)
        cache.set(
            f"pk_auth_{challenge_id}", 
            {"challenge": bytes_to_base64url(options.challenge)},
            timeout=cls.CHALLENGE_TTL
        )
        
        return options, challenge_id

    @classmethod
    def verify_authentication(cls, challenge_id, credential_data, public_key, sign_count):
        stored_data = cache.get(f"pk_auth_{challenge_id}")
        if not stored_data:
            raise ValueError("Challenge expired or invalid")

        rp_settings = cls.get_rp_settings()
        
        logger.debug(f"Verifying Authentication for challenge: {challenge_id}")
        verification = verify_authentication_response(
            credential=credential_data,
            expected_challenge=base64url_to_bytes(stored_data["challenge"]),
            expected_origin=rp_settings["origin"],
            expected_rp_id=rp_settings["rp_id"],
            credential_public_key=base64url_to_bytes(public_key),
            credential_current_sign_count=sign_count,
            require_user_verification=True, # Strictly enforce biometrics/PIN verification
        )
        
        cache.delete(f"pk_auth_{challenge_id}")
        return verification

    @classmethod
    def generate_registration_token(cls, user):
        """
        Generates a short-lived JWT to allow passkey registration.
        Use this after a successful OTP login to authorize the user to create a passkey.
        
        Example:
            if login_successful:
                token = PasskeyService.generate_registration_token(user)
                return JsonResponse({"reg_token": token})
        """
        payload = {
            "sub": cls.get_user_id(user),
            "username": user.username,
            "exp": datetime.utcnow() + timedelta(minutes=10),
            "purpose": "passkey_reg"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    @staticmethod
    def decode_registration_token(token):
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except:
            return None

    @classmethod
    def inject_passkey_context(cls, user, data_dict, flow='login'):
        """
        Smart helper to inject passkey ceremony data into a response dictionary.
        
        Args:
            user: The user object (custom or default)
            data_dict: The dictionary to be returned as JsonResponse
            flow: 'login' or 'register'
        """
        try:
            if flow == 'login':
                if cls.check_user_has_passkeys(user):
                    options, challenge_id = cls.generate_authentication_options(user)
                    data_dict["passkey_options"] = cls.options_to_dict(options)
                    data_dict["challenge_id"] = challenge_id
            elif flow == 'register':
                # Only offer registration if they don't have a passkey yet
                if not cls.check_user_has_passkeys(user):
                    options, challenge_id = cls.generate_registration_options(user)
                    data_dict["passkey_options"] = cls.options_to_dict(options)
                    data_dict["challenge_id"] = challenge_id
                    # Also include a registration token for the final verify step
                    data_dict["reg_token"] = cls.generate_registration_token(user)
        except Exception as e:
            logger.error(f"Failed to inject passkey context: {str(e)}")
            # Safe fallback: return the original dict without passkey data
            # This ensures the business API still works even if passkey fails
        return data_dict

    @staticmethod
    def options_to_dict(options):
        """Utility to convert WebAuthn options to a JSON-serializable dict."""
        from webauthn import options_to_json
        import json
        return json.loads(options_to_json(options))

    @staticmethod
    def check_user_has_passkeys(user):
        """
        Quick check to see if a user has any registered passkeys.
        """
        from .models import PasskeyCredential
        return PasskeyCredential.objects.filter(user=user).exists()
