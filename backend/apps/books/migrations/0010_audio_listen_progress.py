import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('books', '0009_audiobook_support'),
    ]

    operations = [
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
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
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
                'unique_together': {('user', 'book')},
            },
        ),
    ]
