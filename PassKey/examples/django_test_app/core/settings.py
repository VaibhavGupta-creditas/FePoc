import os
from pathlib import Path

import sys
BASE_DIR = Path(__file__).resolve().parent.parent

# Vercel path fix: Add the project root to sys.path
sys.path.append(str(BASE_DIR))

SECRET_KEY = 'django-insecure-test-key'
import dj_database_url

DEBUG = True
ALLOWED_HOSTS = ['*']
APPEND_SLASH = False

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'core',
    'passkey_core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('POSTGRES_URL', f"sqlite:///{BASE_DIR}/db.sqlite3"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://" + os.environ.get('VERCEL_URL', '') if os.environ.get('VERCEL_URL') else "http://localhost:3000"
]
CORS_ALLOW_CREDENTIALS = True

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Production settings
import sys
# Make it more robust for Vercel build environment
pkg_path = os.path.abspath(os.path.join(BASE_DIR, "../../passkey-auth-core"))
if pkg_path not in sys.path:
    sys.path.append(pkg_path)


WSGI_APPLICATION = 'core.wsgi.application'
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# === Passkey Authentication Settings ===

# 1. Platform Identity (WebAuthn Basics)
PASSKEY_RP_ID = "fe-poc-three.vercel.app"
PASSKEY_ORIGIN = "https://fe-poc-three.vercel.app"
PASSKEY_RP_NAME = "Passkey Demo App"

# 2. Source Data (What fields to read from your User model)
PASSKEY_USER_ID_FIELD = "auth_id"           # The unique ID from the model
PASSKEY_USERNAME_FIELD = "name"            # The value shown on the fingerprint prompt

# 3. API Response and Request Mapping (Custom JSON keys)
PASSKEY_ID_JSON_KEY = "user_id"         # Key name for ID in success response
PASSKEY_NAME_JSON_KEY = "username"       # Key name for Username in success response
PASSKEY_ID_REQUEST_KEY = "user_id"       # Key name to fetch authentication options via ID

# 4. Global Error Messages
PASSKEY_ERROR_USER_NOT_FOUND = "Account not found in our records"
PASSKEY_ERROR_CREDENTIAL_NOT_FOUND = "Security key missing for this account"

# Format: "app_label.ModelName"
PASSKEY_USER_MODEL = "core.UserDetails"  # Now using our custom table
# OR if you had a custom one:
# PASSKEY_USER_MODEL = "core.EmployeeAccount"