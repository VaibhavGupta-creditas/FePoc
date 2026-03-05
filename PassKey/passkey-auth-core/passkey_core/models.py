from django.db import models
from django.conf import settings

class PasskeyCredential(models.Model):
    user = models.ForeignKey(
        getattr(settings, "PASSKEY_USER_MODEL", "auth.User"), 
        on_delete=models.CASCADE, 
        related_name='passkeys'
    )
    auth_id = models.CharField(max_length=64, db_index=True, null=True, blank=True)
    credential_id = models.CharField(max_length=512, unique=True) # Stored as base64url
    public_key = models.TextField() # Stored as base64url
    sign_count = models.IntegerField(default=0)
    transports = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'passkey_credentials'
        verbose_name = 'Passkey Credential'
        verbose_name_plural = 'Passkey Credentials'

    def __str__(self):
        return f"{self.user.username} - {self.credential_id[:10]}..."
