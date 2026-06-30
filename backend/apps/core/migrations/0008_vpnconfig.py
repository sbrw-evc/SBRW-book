import uuid
from django.db import migrations, models
import apps.core.encryption


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_encrypt_core_data'),
    ]

    operations = [
        migrations.CreateModel(
            name='VpnConfig',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('config_text', apps.core.encryption.EncryptedTextField()),
                ('is_active', models.BooleanField(db_index=True, default=False)),
                ('last_latency_ms', models.FloatField(blank=True, null=True)),
                ('last_checked', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'vpn_configs', 'ordering': ['created_at']},
        ),
    ]
