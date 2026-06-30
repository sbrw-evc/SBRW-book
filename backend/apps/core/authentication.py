from django.utils import timezone
from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class LastSeenJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            sid = token.get('sid')
            if sid and cache.get(f'blacklist:session:{sid}'):
                raise AuthenticationFailed('Session has been revoked')
            request.current_session_id = sid
            _update_last_seen(user)
        return result


def _update_last_seen(user):
    cache_key = f'last_seen:{user.id}'
    if cache.get(cache_key):
        return
    try:
        type(user).objects.filter(id=user.id).update(last_seen=timezone.now())
    except Exception:
        pass
    cache.set(cache_key, '1', 60)
