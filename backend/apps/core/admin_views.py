from datetime import timedelta

from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.users.permissions import IsAdmin, IsModerator
from apps.users.models import User
from .models import AppSettings, Newsletter, SiteVisit, VpnConfig


class StatsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        from apps.books.models import Book, Author, Series, Tag, BookFile
        from apps.books.serializers import BookShortSerializer

        books_by_format = dict(
            BookFile.objects.values('format')
            .annotate(count=Count('id'))
            .values_list('format', 'count')
        )
        recent_books = (
            Book.objects.prefetch_related('authors', 'files', 'series', 'tags')
            .order_by('-created_at')[:6]
        )
        return Response({
            'total_books': Book.objects.count(),
            'total_users': User.objects.count(),
            'total_authors': Author.objects.count(),
            'total_series': Series.objects.count(),
            'total_tags': Tag.objects.count(),
            'books_by_format': books_by_format,
            'recent_books': BookShortSerializer(recent_books, many=True).data,
        })


class AppSettingsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response({s.key: s.value for s in AppSettings.objects.all()})


class AppSettingUpdateView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, key):
        value = request.data.get('value')
        if value is None:
            value = request.query_params.get('value', '')
        AppSettings.objects.update_or_create(key=key, defaults={'value': value})
        return Response({'success': True})


class SmtpTestView(APIView):
    """Send a test email using the currently saved SMTP settings."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .email import send_email_sync, smtp_is_configured, get_app_name
        if not smtp_is_configured():
            return Response({'detail': 'SMTP is not configured or disabled'}, status=400)
        to = (request.data.get('to') or request.user.email or '').strip()
        if not to:
            return Response({'detail': 'No recipient address'}, status=400)
        try:
            send_email_sync(
                to,
                f'{get_app_name()} — тестовое письмо',
                '<p>SMTP настроен корректно. Это тестовое письмо.</p>',
                'SMTP настроен корректно. Это тестовое письмо.',
            )
        except Exception as exc:
            return Response({'detail': f'SMTP error: {exc}'}, status=400)
        return Response({'success': True, 'to': to})


class NewsletterListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        items = Newsletter.objects.select_related('created_by').all()
        return Response([{
            'id': str(n.id),
            'subject': n.subject,
            'nl_type': n.nl_type,
            'sent_at': n.sent_at,
            'sent_count': n.sent_count,
            'created_at': n.created_at,
            'created_by': n.created_by.username if n.created_by else None,
        } for n in items])

    def post(self, request):
        subject = (request.data.get('subject') or '').strip()
        body_html = (request.data.get('body_html') or '').strip()
        body_text = (request.data.get('body_text') or '').strip()
        nl_type = request.data.get('nl_type', 'custom')
        if not subject or not body_html:
            return Response({'detail': 'subject and body_html required'}, status=400)
        nl = Newsletter.objects.create(
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            nl_type=nl_type,
            created_by=request.user,
        )
        return Response({'id': str(nl.id)}, status=201)


class NewsletterSendView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, nl_id):
        try:
            nl = Newsletter.objects.get(id=nl_id)
        except Newsletter.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        from .email import send_newsletter, smtp_is_configured
        if not smtp_is_configured():
            return Response({'detail': 'SMTP is not configured'}, status=400)

        sent = send_newsletter(nl.subject, nl.body_html, nl.body_text)
        nl.sent_at = timezone.now()
        nl.sent_count = sent
        nl.save(update_fields=['sent_at', 'sent_count'])
        return Response({'success': True, 'sent_count': sent})


class NewsletterPreviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        from .email import _layout, get_app_name
        subject = request.data.get('subject', 'Preview')
        body_html = request.data.get('body_html', '')
        html = _layout(subject, body_html)
        return Response({'html': html})


_VALID_TEMPLATE_EVENTS = ('verify', 'reset', 'series', 'newsletter')


class EmailTemplatesView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from .email import DEFAULT_TEMPLATES
        keys = [f'email_tpl_{e}_{f}' for e in _VALID_TEMPLATE_EVENTS for f in ('subject', 'body')]
        rows = {r.key: r.value for r in AppSettings.objects.filter(key__in=keys)}
        result = {}
        for event in _VALID_TEMPLATE_EVENTS:
            defaults = DEFAULT_TEMPLATES.get(event, {})
            result[event] = {
                'subject': rows.get(f'email_tpl_{event}_subject', ''),
                'body_html': rows.get(f'email_tpl_{event}_body', ''),
                'default_subject': defaults.get('subject', ''),
                'default_body_html': defaults.get('body_html', ''),
            }
        return Response(result)


class EmailTemplateUpdateView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, event):
        if event not in _VALID_TEMPLATE_EVENTS:
            return Response({'detail': 'Invalid event type'}, status=400)
        subject = (request.data.get('subject') or '').strip()
        body_html = (request.data.get('body_html') or '').strip()
        AppSettings.objects.update_or_create(key=f'email_tpl_{event}_subject', defaults={'value': subject})
        AppSettings.objects.update_or_create(key=f'email_tpl_{event}_body', defaults={'value': body_html})
        return Response({'success': True})


class TelegramSettingsView(APIView):
    """GET current Telegram config summary; used by admin settings page."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from .telegram import telegram_is_configured, get_bot_username, get_webhook_info
        configured = telegram_is_configured()
        info = {}
        if configured:
            try:
                info = get_webhook_info()
            except Exception:
                pass
        return Response({
            'configured': configured,
            'bot_username': get_bot_username() or '',
            'webhook_info': info,
        })


class TelegramTestView(APIView):
    """Send a test message to the admin's own Telegram account."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .telegram import send_message_sync, telegram_is_configured, get_app_name
        if not telegram_is_configured():
            return Response({'detail': 'Telegram bot not configured'}, status=400)
        from apps.core.models import TelegramChat
        try:
            chat = request.user.telegram_chat
        except TelegramChat.DoesNotExist:
            return Response({'detail': 'No Telegram linked to your admin account'}, status=400)
        try:
            send_message_sync(
                chat.chat_id,
                f'✅ <b>{get_app_name()}</b>\n\nТестовое сообщение. Telegram настроен корректно.',
            )
        except Exception as exc:
            return Response({'detail': f'Send error: {exc}'}, status=400)
        return Response({'success': True})


class TelegramWebhookSetupView(APIView):
    """Set or delete the Telegram bot webhook URL."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .telegram import set_webhook
        webhook_url = (request.data.get('url') or '').strip()
        if not webhook_url:
            return Response({'detail': 'url required'}, status=400)
        try:
            result = set_webhook(webhook_url)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    def delete(self, request):
        from .telegram import delete_webhook
        try:
            result = delete_webhook()
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)


class TelegramUploadSettingsView(APIView):
    """GET current upload-bot config summary."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.telegram_upload.bot import (
            get_token, get_bot_username, get_webhook_info, is_configured,
        )
        configured = is_configured()
        info = {}
        if configured:
            try:
                info = get_webhook_info(get_token())
            except Exception:
                pass
        return Response({
            'configured':    configured,
            'bot_username':  get_bot_username() or '',
            'webhook_info':  info,
        })


class TelegramUploadWebhookSetupView(APIView):
    """Set or delete the upload bot webhook URL."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from apps.telegram_upload.bot import get_token, set_webhook
        token = get_token()
        if not token:
            return Response({'detail': 'Upload bot token not configured'}, status=400)
        webhook_url = (request.data.get('url') or '').strip()
        if not webhook_url:
            return Response({'detail': 'url required'}, status=400)
        try:
            result = set_webhook(token, webhook_url)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    def delete(self, request):
        from apps.telegram_upload.bot import get_token, delete_webhook
        token = get_token()
        if not token:
            return Response({'detail': 'Upload bot token not configured'}, status=400)
        try:
            result = delete_webhook(token)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)


class BotsRestartView(APIView):
    """Restart the sbrw_bots container via the Docker socket."""
    permission_classes = [IsAdmin]

    def post(self, request):
        import http.client
        import socket as _socket

        class _UnixConn(http.client.HTTPConnection):
            def connect(self):
                s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
                s.connect('/var/run/docker.sock')
                self.sock = s

        container = request.data.get('container', 'sbrw_bots')
                                                        
        if container not in ('sbrw_bots',):
            return Response({'detail': 'Unknown container'}, status=400)

        try:
            conn = _UnixConn('localhost')
                                                                   
            conn.request('POST', f'/containers/{container}/restart?t=10')
            resp = conn.getresponse()
            resp.read()
            if resp.status not in (204, 200):
                return Response({'detail': f'Docker API returned HTTP {resp.status}'}, status=500)
        except FileNotFoundError:
            return Response(
                {'detail': 'Docker socket not available — mount /var/run/docker.sock in the backend container'},
                status=500,
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)

        return Response({'ok': True})


class VpnStatusView(APIView):
    """Real-time WireGuard + bots-container status read from Redis heartbeat."""
    permission_classes = [IsAdmin]

    def get(self, request):
        import json
        from django.core.cache import cache

        enabled_row = AppSettings.objects.filter(key='wireguard_enabled').first()
        config_row = AppSettings.objects.filter(key='wireguard_config').first()

        heartbeat_raw = cache.get('sbrw:bot_heartbeat')
        heartbeat = json.loads(heartbeat_raw) if heartbeat_raw else None

        vpn_status_raw = cache.get('sbrw:vpn_status')
        vpn_status = json.loads(vpn_status_raw) if vpn_status_raw else None

                                                                                           
        if heartbeat is not None:
            vpn_up = heartbeat.get('vpn_up')
        elif vpn_status is not None:
            vpn_up = vpn_status.get('success') or False
        else:
            vpn_up = None

        return Response({
            'configured': bool(config_row and (config_row.value or '').strip()),
            'enabled': enabled_row.value == 'true' if enabled_row else False,
            'bots_online': heartbeat is not None,
            'vpn_up': vpn_up,
            'vpn_peers': heartbeat.get('vpn_peers', 0) if heartbeat else 0,
            'telegram_ok': heartbeat.get('telegram_ok') if heartbeat else None,
            'last_seen': heartbeat.get('last_seen') if heartbeat else None,
            'applied_at': vpn_status.get('applied_at') if vpn_status else None,
            'apply_error': vpn_status.get('error') if vpn_status and not vpn_status.get('success') else None,
        })


class WireGuardView(APIView):
    """GET/PUT/DELETE WireGuard VPN config stored in AppSettings."""
    permission_classes = [IsAdmin]

    def get(self, request):
        enabled_row = AppSettings.objects.filter(key='wireguard_enabled').first()
        config_row = AppSettings.objects.filter(key='wireguard_config').first()
        return Response({
            'enabled': enabled_row.value == 'true' if enabled_row else False,
            'config': (config_row.value or '') if config_row else '',
        })

    def put(self, request):
        config = (request.data.get('config') or '').strip()
        enabled = bool(request.data.get('enabled', False))
        AppSettings.objects.update_or_create(key='wireguard_config', defaults={'value': config})
        AppSettings.objects.update_or_create(key='wireguard_enabled', defaults={'value': 'true' if enabled else 'false'})
        return Response({'ok': True})

    def delete(self, request):
        AppSettings.objects.filter(key__in=['wireguard_config', 'wireguard_enabled']).delete()
        return Response({'ok': True})



class VpnConfigListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        configs = VpnConfig.objects.all()
        return Response([{
            'id':              str(c.id),
            'name':            c.name,
            'is_active':       c.is_active,
            'last_latency_ms': c.last_latency_ms,
            'last_checked':    c.last_checked.isoformat() if c.last_checked else None,
            'created_at':      c.created_at.isoformat(),
        } for c in configs])

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        config_text = (request.data.get('config_text') or '').strip()
        if not name or not config_text:
            return Response({'detail': 'name and config_text required'}, status=400)
        cfg = VpnConfig.objects.create(name=name, config_text=config_text)
        return Response({'id': str(cfg.id)}, status=201)


class VpnConfigDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, config_id):
        try:
            cfg = VpnConfig.objects.get(id=config_id)
        except VpnConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response({
            'id': str(cfg.id), 'name': cfg.name,
            'config_text': cfg.config_text or '',
            'is_active': cfg.is_active,
        })

    def put(self, request, config_id):
        try:
            cfg = VpnConfig.objects.get(id=config_id)
        except VpnConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if 'name' in request.data:
            cfg.name = (request.data['name'] or '').strip() or cfg.name
        if 'config_text' in request.data:
            cfg.config_text = (request.data['config_text'] or '').strip()
        cfg.save()
        return Response({'ok': True})

    def delete(self, request, config_id):
        VpnConfig.objects.filter(id=config_id).delete()
        return Response({'ok': True})


class VpnConfigActivateView(APIView):
    """Manually activate one config (deactivates all others)."""
    permission_classes = [IsAdmin]

    def post(self, request, config_id):
        try:
            cfg = VpnConfig.objects.get(id=config_id)
        except VpnConfig.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        VpnConfig.objects.update(is_active=False)
        cfg.is_active = True
        cfg.save(update_fields=['is_active'])
        return Response({'ok': True})


class VpnTestConfigsView(APIView):
    """Set a Redis flag and restart bots so they test all configs and auto-select the best."""
    permission_classes = [IsAdmin]

    def post(self, request):
        import http.client
        import socket as _socket
        from django.core.cache import cache

        cache.set('sbrw:vpn:run_test_configs', '1', timeout=300)

        class _UnixConn(http.client.HTTPConnection):
            def connect(self):
                s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
                s.connect('/var/run/docker.sock')
                self.sock = s

        try:
            conn = _UnixConn('localhost')
            conn.request('POST', '/containers/sbrw_bots/restart?t=10')
            resp = conn.getresponse(); resp.read()
            if resp.status not in (204, 200):
                return Response({'detail': f'Docker returned HTTP {resp.status}'}, status=500)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)
        return Response({'ok': True})



def _docker_request(method: str, path: str):
    import http.client
    import json
    import socket as _socket

    class _UnixConn(http.client.HTTPConnection):
        def connect(self):
            s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
            s.connect('/var/run/docker.sock')
            self.sock = s

    conn = _UnixConn('localhost')
    conn.request(method, path)
    resp = conn.getresponse()
    raw = resp.read()
    return resp.status, (json.loads(raw) if raw else None)


def _container_stats(container_id: str) -> dict | None:
    """Fetch one-shot stats for a container. Returns parsed CPU/RAM or None on error."""
    try:
        status, data = _docker_request('GET', f'/containers/{container_id}/stats?stream=false&one-shot=true')
        if status != 200 or not data:
            return None

               
        cpu_delta = (data['cpu_stats']['cpu_usage']['total_usage']
                     - data['precpu_stats']['cpu_usage'].get('total_usage', 0))
        sys_delta  = (data['cpu_stats'].get('system_cpu_usage', 0)
                      - data['precpu_stats'].get('system_cpu_usage', 0))
        num_cpus   = data['cpu_stats'].get('online_cpus') or len(
            data['cpu_stats']['cpu_usage'].get('percpu_usage') or [1]
        )
        cpu_pct = round((cpu_delta / sys_delta) * num_cpus * 100, 2) if sys_delta > 0 else 0.0

                
        mem       = data.get('memory_stats', {})
        mem_usage = mem.get('usage', 0) - mem.get('stats', {}).get('cache', 0)
        mem_limit = mem.get('limit', 0)
        mem_pct   = round(mem_usage / mem_limit * 100, 2) if mem_limit else 0.0

        return {
            'cpu_pct':   cpu_pct,
            'mem_usage': mem_usage,
            'mem_limit': mem_limit,
            'mem_pct':   mem_pct,
        }
    except Exception:
        return None


class DockerContainersView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        import threading
        import shutil

        try:
            _, containers = _docker_request('GET', '/containers/json?all=1')
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)

        results = {}

        def _fetch_stats(cid, name):
            results[name] = _container_stats(cid)

        threads = []
        rows = []
        for c in (containers or []):
            name   = (c.get('Names') or ['unknown'])[0].lstrip('/')
            cid    = c.get('Id', '')
            status = c.get('Status', '')
            state  = c.get('State', '')
            image  = (c.get('Image') or '').split(':')[0].split('/')[-1]
            created = c.get('Created', 0)
            rows.append({'name': name, 'id': cid, 'status': status, 'state': state, 'image': image, 'created': created})
            t = threading.Thread(target=_fetch_stats, args=(cid, name))
            t.start()
            threads.append(t)

        for t in threads:
            t.join(timeout=5)

                                                       
        try:
            disk = shutil.disk_usage('/')
            disk_info = {
                'total': disk.total,
                'used':  disk.used,
                'free':  disk.free,
                'pct':   round(disk.used / disk.total * 100, 1),
            }
        except Exception:
            disk_info = None

        output = []
        for r in rows:
            s = results.get(r['name'])
            output.append({**r, 'stats': s})

        return Response({'containers': output, 'disk': disk_info})


class DockerContainerRestartView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, container_name):
        import http.client
        import socket as _socket

        class _UnixConn(http.client.HTTPConnection):
            def connect(self):
                s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
                s.connect('/var/run/docker.sock')
                self.sock = s

        try:
            conn = _UnixConn('localhost')
            conn.request('POST', f'/containers/{container_name}/restart?t=10')
            resp = conn.getresponse(); resp.read()
            if resp.status not in (204, 200):
                return Response({'detail': f'Docker returned HTTP {resp.status}'}, status=500)
        except FileNotFoundError:
            return Response({'detail': 'Docker socket not available'}, status=500)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)
        return Response({'ok': True})


class DockerContainerLogsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, container_name):
        import http.client
        import socket as _socket
        import struct

        lines = int(request.query_params.get('lines', 200))

        class _UnixConn(http.client.HTTPConnection):
            def connect(self):
                s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
                s.settimeout(10)
                s.connect('/var/run/docker.sock')
                self.sock = s

        try:
            conn = _UnixConn('localhost')
            conn.request(
                'GET',
                f'/containers/{container_name}/logs?stdout=1&stderr=1&tail={lines}&timestamps=1',
            )
            resp = conn.getresponse()
            if resp.status != 200:
                return Response({'detail': f'Docker returned HTTP {resp.status}'}, status=404)

            raw = resp.read()
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)

                                                            
        log_lines = []
        offset = 0
        while offset + 8 <= len(raw):
            stream_type = raw[offset]                       
            size = struct.unpack('>I', raw[offset + 4:offset + 8])[0]
            offset += 8
            if offset + size > len(raw):
                break
            text = raw[offset:offset + size].decode('utf-8', errors='replace').rstrip('\n')
            offset += size
            for line in text.splitlines():
                log_lines.append({'stream': 'stderr' if stream_type == 2 else 'stdout', 'text': line})

        return Response({'logs': log_lines})


class AnalyticsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.books.models import Book, ReadingProgress, BookComment, UserRating

        period = request.query_params.get('period', 'month')
        now = timezone.now()
        if period == 'week':
            since = now - timedelta(days=7)
        elif period == 'month':
            since = now - timedelta(days=30)
        elif period == 'year':
            since = now - timedelta(days=365)
        else:
            since = None

        rp_qs = ReadingProgress.objects.all()
        comment_qs = BookComment.objects.all()
        rating_qs = UserRating.objects.all()
        visit_qs = SiteVisit.objects.all()

        if since:
            rp_qs = rp_qs.filter(last_read__gte=since)
            comment_qs = comment_qs.filter(created_at__gte=since)
            rating_qs = rating_qs.filter(created_at__gte=since)
            visit_qs = visit_qs.filter(date__gte=since.date())

                                        
        most_read = list(
            rp_qs.values('book_id', 'book__title', 'book__cover_path')
            .annotate(readers=Count('user_id', distinct=True))
            .order_by('-readers')[:10]
        )
        for item in most_read:
            item['book_id'] = str(item['book_id'])

                                 
        most_completed = list(
            rp_qs.filter(percentage__gte=90)
            .values('book_id', 'book__title', 'book__cover_path')
            .annotate(completions=Count('user_id', distinct=True))
            .order_by('-completions')[:10]
        )
        for item in most_completed:
            item['book_id'] = str(item['book_id'])

                         
        most_downloaded = list(
            Book.objects.filter(download_count__gt=0)
            .values('id', 'title', 'cover_path', 'download_count')
            .order_by('-download_count')[:10]
        )
        for item in most_downloaded:
            item['id'] = str(item['id'])

                       
        top_uploaders = list(
            Book.objects.values('uploaded_by_id', 'uploaded_by__username', 'uploaded_by__avatar')
            .annotate(uploads=Count('id'))
            .order_by('-uploads')[:10]
        )
        for item in top_uploaders:
            if item['uploaded_by_id']:
                item['uploaded_by_id'] = str(item['uploaded_by_id'])

                        
        top_commenters = list(
            comment_qs.values('user_id', 'user__username', 'user__avatar')
            .annotate(comments=Count('id'))
            .order_by('-comments')[:10]
        )
        for item in top_commenters:
            item['user_id'] = str(item['user_id'])

                    
        top_raters = list(
            rating_qs.values('user_id', 'user__username', 'user__avatar')
            .annotate(ratings=Count('id'))
            .order_by('-ratings')[:10]
        )
        for item in top_raters:
            item['user_id'] = str(item['user_id'])

                                       
        visits_daily = list(
            visit_qs.values('date')
            .annotate(
                total=Count('id'),
                registered=Count('id', filter=Q(is_authenticated=True)),
            )
            .order_by('date')
        )
        for item in visits_daily:
            item['date'] = str(item['date'])

        total_visits = visit_qs.count()
        registered_visits = visit_qs.filter(is_authenticated=True).count()

        return Response({
            'period': period,
            'most_read': most_read,
            'most_completed': most_completed,
            'most_downloaded': most_downloaded,
            'top_uploaders': top_uploaders,
            'top_commenters': top_commenters,
            'top_raters': top_raters,
            'visits_daily': visits_daily,
            'total_visits': total_visits,
            'registered_visits': registered_visits,
        })



class LLMStatusView(APIView):
    """GET /api/admin/llm/status — check LLM service health and current settings."""
    permission_classes = [IsAdmin]

    def get(self, request):
        import os, requests as req
        from apps.books.llm_client import _get
        llm_url = os.environ.get('LLM_SERVICE_URL', 'http://llm:8100')
        service_healthy = False
        try:
            r = req.get(f'{llm_url}/health', timeout=5)
            service_healthy = r.status_code == 200
        except Exception:
            pass

        return Response({
            'service_healthy': service_healthy,
            'service_url': llm_url,
            'enabled':    _get('llm_enabled',    'false'),
            'provider':   _get('llm_provider',   'local'),
            'model':      _get('llm_model',       ''),
            'ollama_url': _get('llm_ollama_url',  'http://ollama:11434'),
            'max_chars':  _get('llm_max_chars',   '18000'),
        })


class LLMTestView(APIView):
    """POST /api/admin/llm/test — send a short test prompt to the LLM service."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from apps.books.llm_client import call_llm_service
        result = call_llm_service(
            text='Это тестовый текст. Коротко ответь что получил сигнал.',
            title='Тест',
            authors=['Тест'],
        )
        if result.get('error'):
            return Response({'detail': result['error']}, status=400)
        return Response({'success': True, 'review': result.get('review'), 'metadata': result.get('metadata')})


class LLMOllamaModelsView(APIView):
    """GET /api/admin/llm/ollama-models — list models available in Ollama."""
    permission_classes = [IsAdmin]

    def get(self, request):
        import requests as req
        from apps.books.llm_client import _get
        ollama_url = _get('llm_ollama_url', 'http://ollama:11434')
        try:
            r = req.get(f'{ollama_url}/api/tags', timeout=5)
            r.raise_for_status()
            models = [m['name'] for m in r.json().get('models', [])]
            return Response({'models': models})
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)


class LLMOllamaPullView(APIView):
    """POST /api/admin/llm/ollama-pull — pull a model with SSE progress stream."""
    permission_classes = [IsAdmin]

    def post(self, request):
        import json
        import requests as req
        from django.http import StreamingHttpResponse
        from apps.books.llm_client import _get

        model = (request.data.get('model') or '').strip()
        if not model:
            return Response({'detail': 'model required'}, status=400)

        ollama_url = _get('llm_ollama_url', 'http://ollama:11434')

        def generate():
            try:
                resp = req.post(
                    f'{ollama_url}/api/pull',
                    json={'name': model, 'stream': True},
                    stream=True,
                    timeout=600,
                )
                for line in resp.iter_lines():
                    if line:
                        yield f'data: {line.decode()}\n\n'
            except Exception as exc:
                yield f'data: {json.dumps({"error": str(exc)})}\n\n'
            yield 'data: {"done":true}\n\n'

        response = StreamingHttpResponse(generate(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class LLMBookAnalyzeView(APIView):
    """POST /api/admin/llm/analyze/<book_id> — trigger AI review for a book."""
    permission_classes = [IsAdmin]

    def post(self, request, book_id):
        from apps.books.models import Book
        from apps.core import kafka_client
        try:
            book = Book.objects.prefetch_related('authors', 'files').get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        book_file = book.files.first()
        if not book_file:
            return Response({'detail': 'No book file'}, status=400)
        book.ai_review_status = 'pending'
        book.save(update_fields=['ai_review_status'])
        kafka_client.produce(kafka_client.TOPIC_LLM_ANALYZE, {
            'book_id': str(book.id),
            'file_path': book_file.file_path,
            'title': book.title,
            'authors': [a.name for a in book.authors.all()],
        }, key=str(book.id))
        return Response({'status': 'pending'})
