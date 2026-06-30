import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_newsletter'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('ip_hash', models.CharField(db_index=True, max_length=16)),
                ('is_authenticated', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='site_visits',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'site_visits',
                'unique_together': {('date', 'ip_hash')},
            },
        ),
    ]
