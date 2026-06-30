"""Recreate audio_listen_progress as per-chapter (unique per user+chapter instead of user+book)."""
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('books', '0010_audio_listen_progress'),
    ]

    operations = [
        migrations.DeleteModel(name='AudioListenProgress'),
        migrations.CreateModel(
            name='AudioListenProgress',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('position_seconds', models.FloatField(default=0)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('book', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='listen_progress',
                    to='books.book',
                )),
                ('chapter', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_progress',
                    to='books.audiochapter',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audio_listen_progress',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'audio_listen_progress',
                'unique_together': {('user', 'chapter')},
            },
        ),
    ]
