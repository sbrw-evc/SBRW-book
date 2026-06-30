import hashlib

from django.core.cache import cache
from django.utils import timezone


_SKIP_PREFIXES = ('/uploads/', '/health', '/static/')


class VisitTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._track(request)
        return response

    def _track(self, request):
        path = request.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return

        ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '')
            .split(',')[0]
            .strip()
            or request.META.get('REMOTE_ADDR', '')
        )
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
        today = str(timezone.now().date())
        visit_key = f'visit:{today}:{ip_hash}'

        if cache.get(visit_key):
            return

        try:
            from apps.core.models import SiteVisit
            user = getattr(request, 'user', None)
            is_auth = user is not None and getattr(user, 'is_authenticated', False)
            if callable(is_auth):
                is_auth = is_auth()
            SiteVisit.objects.get_or_create(
                date=today,
                ip_hash=ip_hash,
                defaults={
                    'is_authenticated': is_auth,
                    'user': user if is_auth else None,
                },
            )
        except Exception:
            pass

        cache.set(visit_key, '1', 86400)
