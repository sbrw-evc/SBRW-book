import re
import requests as _http


def parse_user_agent(ua: str) -> tuple[str, str]:
    """Returns (os_string, browser_string) from a User-Agent header."""
    if 'Android' in ua:
        m = re.search(r'Android ([\d.]+)', ua)
        os_str = f'Android {m.group(1)}' if m else 'Android'
    elif 'iPhone' in ua or 'iPad' in ua:
        m = re.search(r'OS (\d+_\d+)', ua)
        v = m.group(1).replace('_', '.') if m else ''
        os_str = f'iOS {v}' if v else 'iOS'
    elif 'Windows NT' in ua:
        nt_map = {'10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista'}
        m = re.search(r'Windows NT ([\d.]+)', ua)
        nt = m.group(1) if m else ''
        os_str = f'Windows {nt_map.get(nt, nt)}'
    elif 'Mac OS X' in ua:
        m = re.search(r'Mac OS X ([\d][_.\d]*)', ua)
        v = m.group(1).replace('_', '.') if m else ''
                                                                
        major = v.split('.')[0] if v else ''
        os_str = f'macOS {major}' if major else 'macOS'
    elif 'Linux' in ua or 'X11' in ua:
        os_str = 'GNU/Linux'
    else:
        os_str = 'Unknown'

    if re.search(r'Edg/', ua):
        m = re.search(r'Edg/([\d.]+)', ua)
        browser_str = f'Edge {m.group(1).split(".")[0]}' if m else 'Edge'
    elif re.search(r'OPR/', ua):
        m = re.search(r'OPR/([\d.]+)', ua)
        browser_str = f'Opera {m.group(1).split(".")[0]}' if m else 'Opera'
    elif re.search(r'Firefox/([\d.]+)', ua):
        m = re.search(r'Firefox/([\d.]+)', ua)
        browser_str = f'Firefox {m.group(1)}' if m else 'Firefox'
    elif re.search(r'Chrome/([\d.]+)', ua):
        m = re.search(r'Chrome/([\d.]+)', ua)
        v = m.group(1).split('.')[0] if m else ''
        browser_str = f'Chrome {v}' if v else 'Chrome'
    elif 'Safari/' in ua and 'Version/' in ua:
        m = re.search(r'Version/([\d.]+)', ua)
        v = m.group(1).split('.')[0] if m else ''
        browser_str = f'Safari {v}' if v else 'Safari'
    else:
        browser_str = 'Unknown'

    return os_str, browser_str


def get_ip_location(ip: str) -> tuple[str, str]:
    """Returns (country, city) from ip-api.com. Falls back to ('', '') on any error."""
    if not ip or ip in ('127.0.0.1', '::1', 'testserver'):
        return ('', '')
    try:
        resp = _http.get(
            f'http://ip-api.com/json/{ip}',
            params={'fields': 'status,country,city', 'lang': 'ru'},
            timeout=3,
        )
        data = resp.json()
        if data.get('status') == 'success':
            return data.get('country', ''), data.get('city', '')
    except Exception:
        pass
    return ('', '')
