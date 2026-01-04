#!/bin/sh

# Default to empty object if not set
cat <<EOF > /usr/share/nginx/html/env-config.js
window.env = {
  VITE_GEMINI_API_KEY: "${VITE_GEMINI_API_KEY}"
};
EOF

# Start Nginx
exec nginx -g "daemon off;"
