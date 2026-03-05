from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model, login
from django.conf import settings
from .services import PasskeyService
from .models import PasskeyCredential
import json
import logging
from webauthn import options_to_json
from webauthn.helpers import bytes_to_base64url

from django.apps import apps

logger = logging.getLogger(__name__)

def _get_user_model():
    """Dynamically resolves the user model from settings."""
    model_path = PasskeyService.get_setting("USER_MODEL", "auth.User")
    return apps.get_model(model_path)

class RegistrationOptionsView(APIView):
    """
    Step 1: Get Registration Options.
    The client sends a signed registration token (JWT).
    Returns WebAuthn options and a unique challenge ID.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token_key = PasskeyService.get_setting("TOKEN_REQUEST_KEY", "token")
        token = request.data.get(token_key)
        payload = PasskeyService.decode_registration_token(token)
        
        if not payload or payload.get('purpose') != 'passkey_reg':
            error_msg = PasskeyService.get_setting("ERROR_INVALID_TOKEN", "Invalid or expired registration token")
            return Response({"error": error_msg}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            UserModel = _get_user_model()
            raw_id = PasskeyService.decrypt_user_id(payload['sub'])
            if not raw_id:
                 raise UserModel.DoesNotExist()
            
            user_id_field = PasskeyService.get_setting("USER_ID_FIELD", "id")
            # Convert dot notation (profile.auth_id) to Django __ notation (profile__auth_id)
            query_field = str(user_id_field).replace('.', '__')
            kwargs = {query_field: raw_id}
            logger.debug(f"Looking up user with {kwargs}")
            user = UserModel.objects.get(**kwargs)
            
            options, challenge_id = PasskeyService.generate_registration_options(user)
            return Response({
                "challenge_id": challenge_id,
                "options": json.loads(options_to_json(options))
            })
        except Exception as e:
            UserModel = _get_user_model()
            if isinstance(e, UserModel.DoesNotExist):
                error_msg = PasskeyService.get_setting("ERROR_USER_NOT_FOUND", "User not found")
                return Response({"error": error_msg}, status=status.HTTP_404_NOT_FOUND)
            raise e

class RegistrationResultView(APIView):
    """
    Step 2: Verify Registration.
    Browser sends the generated credential.
    We verify it, and if valid, save the public key linked to the user.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        challenge_key = PasskeyService.get_setting("CHALLENGE_ID_REQUEST_KEY", "challenge_id")
        credential_key = PasskeyService.get_setting("CREDENTIAL_REQUEST_KEY", "credential")
        
        challenge_id = request.data.get(challenge_key)
        credential = request.data.get(credential_key)
        
        try:
            UserModel = _get_user_model()
            verification, user_db_id = PasskeyService.verify_registration(challenge_id, credential)
            user = UserModel.objects.get(id=user_db_id)
            
            # Fetch the raw auth_id to save in the credential for fast lookups
            auth_id_field = PasskeyService.get_setting("USER_ID_FIELD", "id")
            raw_auth_id = PasskeyService.get_nested_attr(user, auth_id_field)

            PasskeyCredential.objects.create(
                user=user,
                auth_id=raw_auth_id,
                credential_id=credential.get('id'),
                public_key=bytes_to_base64url(verification.credential_public_key),
                sign_count=verification.sign_count,
                transports=credential.get("response", {}).get("transports", [])
            )
            logger.info(f"Passkey registered successfully for user {user.username}")
            return Response({"status": "success", "message": "Passkey registered successfully"})
        except Exception as e:
            logger.error(f"Registration verification failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AuthenticationOptionsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username_key = PasskeyService.get_setting("USERNAME_REQUEST_KEY", "username")
        id_request_key = PasskeyService.get_setting("ID_REQUEST_KEY", "user_id")
        
        username = request.data.get(username_key)
        encrypted_id = request.data.get(id_request_key)
        
        user = None
        UserModel = _get_user_model()
        
        # 1. Try to find user by encrypted ID first (More secure)
        if encrypted_id:
            raw_id = PasskeyService.decrypt_user_id(encrypted_id)
            if raw_id:
                try:
                    user_id_field = PasskeyService.get_setting("USER_ID_FIELD", "id")
                    query_field = str(user_id_field).replace('.', '__')
                    user = UserModel.objects.get(**{query_field: raw_id})
                    logger.debug(f"Resolved user {user.username} via encrypted ID")
                except UserModel.DoesNotExist:
                    logger.warning(f"Encrypted ID {encrypted_id} corresponds to non-existent user identifier {raw_id}")

        # 2. Fallback to username if ID lookup failed or wasn't provided
        if not user and username:
            try:
                user = UserModel.objects.get(username=username)
            except UserModel.DoesNotExist:
                error_msg = PasskeyService.get_setting("ERROR_USER_NOT_FOUND", "User not found")
                return Response({"error": error_msg}, status=status.HTTP_404_NOT_FOUND)
        
        options, challenge_id = PasskeyService.generate_authentication_options(user)
        return Response({
            "challenge_id": challenge_id,
            "options": json.loads(options_to_json(options))
        })

class AuthenticationResultView(APIView):
    """
    Step 2: Verify Authentication (Login).
    We find the stored public key using the credential ID, verify the signature,
    and then call Django's login() to start a session.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        challenge_key = PasskeyService.get_setting("CHALLENGE_ID_REQUEST_KEY", "challenge_id")
        credential_key = PasskeyService.get_setting("CREDENTIAL_REQUEST_KEY", "credential")
        
        challenge_id = request.data.get(challenge_key)
        credential_data = request.data.get(credential_key)
        
        # Find credential
        cred_id_str = credential_data["id"]
        try:
            cred = PasskeyCredential.objects.get(
                credential_id=cred_id_str
            )
            verification = PasskeyService.verify_authentication(
                challenge_id, 
                credential_data, 
                cred.public_key, 
                cred.sign_count
            )
            
            # Update sign count
            cred.sign_count = verification.new_sign_count
            cred.save()
            
            logger.info(f"Passkey verification successful for user: {cred.user.username}")
            
            # Generate a new session/auth token (You can customize this to return your own JWT)
            auth_token = PasskeyService.generate_registration_token(cred.user) 
            
            return Response({
                "status": "success", 
                "token": auth_token,
                PasskeyService.get_setting("NAME_JSON_KEY", "username"): PasskeyService.get_username(cred.user),
                PasskeyService.get_setting("ID_JSON_KEY", "user_id"): PasskeyService.get_user_id(cred.user)
            })
        except PasskeyCredential.DoesNotExist:
            error_msg = PasskeyService.get_setting("ERROR_CREDENTIAL_NOT_FOUND", "Credential not found")
            return Response({"error": error_msg}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Passkey authentication failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PasskeyStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_passkeys = PasskeyService.check_user_has_passkeys(request.user)
        data = {"has_passkeys": has_passkeys}
        if not has_passkeys:
            data["reg_token"] = PasskeyService.generate_registration_token(request.user)
        
        id_key = PasskeyService.get_setting("ID_JSON_KEY", "user_id")
        data[id_key] = PasskeyService.get_user_id(request.user)
        return Response(data)

class CleanupChallengeView(APIView):
    """
    Optional endpoint to manually expire a challenge in Redis 
    if the browser operation is cancelled.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        challenge_id = request.data.get("challenge_id")
        type = request.data.get("type") # 'reg' or 'auth'
        
        if not challenge_id:
            return Response({"error": "Missing challenge_id"}, status=status.HTTP_400_BAD_REQUEST)
            
        prefix = "pk_reg_" if type == "reg" else "pk_auth_"
        from django.core.cache import cache
        cache.delete(f"{prefix}{challenge_id}")
        
        return Response({"status": "cleaned"})
