from django.urls import path
from .api_views import (
    RegistrationOptionsView, 
    RegistrationResultView,
    AuthenticationOptionsView,
    AuthenticationResultView,
    PasskeyStatusView,
    CleanupChallengeView
)

urlpatterns = [
    path('register/options/', RegistrationOptionsView.as_view(), name='passkey-register-options'),
    path('register/result/', RegistrationResultView.as_view(), name='passkey-register-result'),
    path('login/options/', AuthenticationOptionsView.as_view(), name='passkey-login-options'),
    path('login/result/', AuthenticationResultView.as_view(), name='passkey-login-result'),
    path('status/', PasskeyStatusView.as_view(), name='passkey-status'),
    path('cleanup/', CleanupChallengeView.as_view(), name='passkey-cleanup'),
]
