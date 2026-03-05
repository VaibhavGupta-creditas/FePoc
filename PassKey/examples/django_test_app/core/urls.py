from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from passkey_core.services import PasskeyService
from django.views.decorators.csrf import csrf_exempt
import json
import logging
# from django.contrib.auth.models import User
from core.models import UserDetails

logger = logging.getLogger(__name__)

@csrf_exempt
def check_account(request):
    """Step 1: Check mobile/card and see if passkey exists."""
    if request.method == 'POST':
        data = json.loads(request.body)
        mobile = data.get('mobile')
        card = data.get('card')
        
        if not mobile or not card:
            return JsonResponse({"status": "error", "message": "Mobile and Card are required"}, status=400)

        # Check user
        try:
            user = UserDetails.objects.get(mobile=mobile)
            if user.cardnumber != card:
                return JsonResponse({"status": "error", "message": "Invalid Card Details for this mobile number"}, status=400)
        except UserDetails.DoesNotExist:
            user, _ = UserDetails.objects.get_or_create(
                mobile=mobile,
                defaults={
                    'name': f"User_{mobile}",
                    'email': f"{mobile}@example.com",
                    'cardnumber': card
                }
            )
        
        # Prepare business response
        res_data = {
            "status": "success",
            "has_passkey": PasskeyService.check_user_has_passkeys(user),
            "username": PasskeyService.get_username(user),
            "user_id": PasskeyService.get_user_id(user)
        }
        
        # FUSE: Inject passkey options directly into this response
        return JsonResponse(PasskeyService.inject_passkey_context(user, res_data, flow='login'))
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def verify_otp(request):
    """Step 2: Verify OTP and return registration options directly."""
    if request.method == 'POST':
        data = json.loads(request.body)
        otp = data.get('otp')
        user_id = data.get('user_id')
        
        if otp == '123456': # Mock OTP
            raw_auth_id = PasskeyService.decrypt_user_id(user_id)
            try:
                user = UserDetails.objects.get(auth_id=raw_auth_id)
            except UserDetails.DoesNotExist:
                return JsonResponse({"status": "error", "message": "User not found"}, status=404)

            # Prepare business response
            res_data = {
                "status": "success",
                "message": "OTP Verified",
                "show_passkey_prompt": not PasskeyService.check_user_has_passkeys(user)
            }
            
            # FUSE: Inject registration options directly into this response
            return JsonResponse(PasskeyService.inject_passkey_context(user, res_data, flow='register'))
        
        return JsonResponse({"status": "error", "message": "Invalid OTP"}, status=400)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def verify_passkey(request):
    """Step 3: Unified endpoint to verify any passkey response (Login or Register)."""
    if request.method == 'POST':
        data = json.loads(request.body)
        challenge_id = data.get('challenge_id')
        credential = data.get('credential')
        reg_token = data.get('reg_token')
        
        try:
            from passkey_core.models import PasskeyCredential
            from passkey_core.api_views import _get_user_model
            
            if reg_token:
                # Flow A: Verifying a NEW Registration
                payload = PasskeyService.decode_registration_token(reg_token)
                if not payload:
                    return JsonResponse({"status": "error", "message": "Invalid or expired registration token"}, status=400)
                
                UserModel = _get_user_model()
                raw_id = PasskeyService.decrypt_user_id(payload['sub'])
                user = UserModel.objects.get(auth_id=raw_id)
                
                verification, _ = PasskeyService.verify_registration(challenge_id, credential)
                
                from webauthn.helpers import bytes_to_base64url
                
                # Save the new credential
                PasskeyCredential.objects.create(
                    user=user,
                    auth_id=user.auth_id,
                    credential_id=bytes_to_base64url(verification.credential_id),
                    public_key=bytes_to_base64url(verification.credential_public_key),
                    sign_count=verification.sign_count,
                    transports=credential.get("response", {}).get("transports", [])
                )
                logger.info(f"Passkey registered successfully for user: {user.username}")
                return JsonResponse({"status": "success", "message": "Passkey registered successfully"})
            
            else:
                # Flow B: Verifying a Login
                cred_id_str = credential["id"]
                cred = PasskeyCredential.objects.get(credential_id=cred_id_str)
                
                verification = PasskeyService.verify_authentication(
                    challenge_id, 
                    credential, 
                    cred.public_key, 
                    cred.sign_count
                )
                
                # Success
                cred.sign_count = verification.new_sign_count
                cred.save()
                
                # Generate a session token
                token = PasskeyService.generate_registration_token(cred.user) 
                
                return JsonResponse({
                    "status": "success",
                    "token": token,
                    "username": PasskeyService.get_username(cred.user),
                    "message": "Login successful"
                })
                
        except Exception as e:
            logger.error(f"Passkey verification failed: {str(e)}")
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

    return JsonResponse({"error": "Method not allowed"}, status=405)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/passkey/', include('passkey_core.urls')),
    path('api/check-account/', check_account),
    path('api/verify-otp/', verify_otp),
    path('api/verify-passkey/', verify_passkey),
]
