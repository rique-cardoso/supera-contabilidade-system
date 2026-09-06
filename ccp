Traceback (most recent call last):
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/manage.py", line 22, in <module>
    main()
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/manage.py", line 18, in main
    execute_from_command_line(sys.argv)
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/django/core/management/__init__.py", line 443, in execute_from_command_line
    utility.execute()
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/django/core/management/__init__.py", line 383, in execute
    settings.INSTALLED_APPS
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/django/conf/__init__.py", line 75, in __getattr__
    self._setup(name)
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/django/conf/__init__.py", line 62, in _setup
    self._wrapped = Settings(settings_module)
                    ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/django/conf/__init__.py", line 162, in __init__
    mod = importlib.import_module(self.SETTINGS_MODULE)
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.12/importlib/__init__.py", line 90, in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<frozen importlib._bootstrap>", line 1387, in _gcd_import
  File "<frozen importlib._bootstrap>", line 1360, in _find_and_load
  File "<frozen importlib._bootstrap>", line 1331, in _find_and_load_unlocked
  File "<frozen importlib._bootstrap>", line 935, in _load_unlocked
  File "<frozen importlib._bootstrap_external>", line 995, in exec_module
  File "<frozen importlib._bootstrap>", line 488, in _call_with_frames_removed
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/setup/settings.py", line 163, in <module>
    EMAIL_HOST_USER = config('EMAIL_HOST_USER')
                      ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/decouple.py", line 248, in __call__
    return self.config(*args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/decouple.py", line 107, in __call__
    return self.get(*args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/rick/Documentos/Projetos/supera-contabilidade-system/venv/lib/python3.12/site-packages/decouple.py", line 92, in get
    raise UndefinedValueError('{} not found. Declare it as envvar or define a default value.'.format(option))
decouple.UndefinedValueError: EMAIL_HOST_USER not found. Declare it as envvar or define a default value.
