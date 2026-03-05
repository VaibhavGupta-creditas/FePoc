from django.db import models
from django.contrib.auth.models import User

import uuid

# class UserProfile(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
#     auth_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
#     display_name = models.CharField(max_length=100, null=True, blank=True)
#     mobile = models.CharField(max_length=15, unique=True)
#     card_number = models.CharField(max_length=4) # Storing last 4 digits for demo
#
#     def save(self, *args, **kwargs):
#         if not self.auth_id:
#             self.auth_id = str(uuid.uuid4())
#         if not self.display_name:
#             self.display_name = self.user.username
#         super().save(*args, **kwargs)
#
#     def __str__(self):
#         return f"{self.display_name} ({self.auth_id})"

class UserDetails(models.Model):
    name = models.CharField(max_length=100)
    mobile = models.CharField(max_length=15, unique=True)
    email = models.EmailField(unique=True)
    cardnumber = models.CharField(max_length=16)
    
    # Required for Passkey dynamic mapping
    auth_id = models.CharField(max_length=64, unique=True, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.auth_id:
            import uuid
            self.auth_id = str(uuid.uuid4())
        super().save(*args, **kwargs)

    @property
    def username(self):
        """Compatibility property for logging/lookups in api_views."""
        return self.mobile

    def __str__(self):
        return f"{self.name} ({self.mobile})"
