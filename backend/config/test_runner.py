from django.test.runner import DiscoverRunner


class TerminateConnectionsRunner(DiscoverRunner):
    """Test runner that terminates stale DB connections before dropping the test DB.

    Background threads (Kafka producer, Channels workers) can hold open connections
    that prevent PostgreSQL from dropping the test database on teardown.
    """

    def teardown_databases(self, old_config, **kwargs):
        from django.db import connections
        for alias in connections:
            conn = connections[alias]
            if conn.vendor == 'postgresql':
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT pg_terminate_backend(pid)
                            FROM pg_stat_activity
                            WHERE datname = current_database()
                              AND pid <> pg_backend_pid()
                        """)
                except Exception:
                    pass
        super().teardown_databases(old_config, **kwargs)
