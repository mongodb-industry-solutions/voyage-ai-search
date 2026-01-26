#!/bin/sh
. /usr/local/share/rt/bin/activate
cd /usr/local/share/voyage-ai-search || exit 1

/usr/pkg/sbin/daemonize \
  -u bjjl \
  -c /usr/local/share/voyage-ai-search \
  -o /tmp/voyage.log -e /tmp/voyage.log \
  -p /var/run/voyage.pid -l /var/run/voyage.lock \
  /usr/local/share/rt/bin/python app.py
