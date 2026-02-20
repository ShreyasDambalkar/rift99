from flask import Flask, send_from_directory, request, Response
import requests
import os

# Serve from the built React folder
app = Flask(__name__, static_folder='frontend/dist')

# Backend runs on port 8001
BACKEND_URL = "http://localhost:8001"

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_api(path):
    # Proxy all /api requests to the backend server
    resp = requests.request(
        method=request.method,
        url=f"{BACKEND_URL}/api/{path}",
        headers={key: value for (key, value) in request.headers if key != 'Host'},
        data=request.get_data(),
        cookies=request.cookies,
        allow_redirects=False)

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
               if name.lower() not in excluded_headers]

    return Response(resp.content, resp.status_code, headers)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Serve on port 80 so ngrok (forwarding port 80) works
    app.run(host='0.0.0.0', port=80)
