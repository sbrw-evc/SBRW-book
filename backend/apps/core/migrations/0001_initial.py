from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='AppSettings',
            fields=[
                ('key', models.CharField(max_length=100, primary_key=True, serialize=False)),
                ('value', models.TextField(blank=True, null=True)),
            ],
            options={
                'db_table': 'app_settings',
            },
        ),
    ]
