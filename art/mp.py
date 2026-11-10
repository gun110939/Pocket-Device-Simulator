"""MaxPlus image-edit client used to generate the pixel art in this repo.
usage: mp.py OUT "prompt" SIZE REF...   Key: ~/.config/maxplus/key (never printed)."""
import json, os, sys, time, subprocess, pathlib
BASE = 'https://api.maxplus-ai.cc'
KEY = pathlib.Path('~/.config/maxplus/key').expanduser().read_text().strip()
def curl(*a):
    return subprocess.run(['curl', '-s', '-m', '300', '-H', f'Authorization: Bearer {KEY}', *a], capture_output=True, text=True).stdout
def ok(path):  # whole-file decode check (truncated downloads still return 200)
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'null', '-'], capture_output=True, text=True)
    return r.returncode == 0 and not r.stderr.strip()
out, prompt, size, refs = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
args = ['-F', f"model={os.environ.get('MP_MODEL', 'gpt-image-2.5-flare')}", '-F', f'size={size}', '-F', f'prompt={prompt}']
for r in refs: args += ['-F', f'images=@{r}']
j = json.loads(curl(*args, BASE + '/v1/images/edits')); print('job', j.get('id'), flush=True)
if 'id' not in j: sys.exit(json.dumps(j))
while True:
    time.sleep(10)
    st = json.loads(curl(f"{BASE}/v1/images/{j['id']}")); s = st.get('status'); print(s, flush=True)
    if s in ('completed', 'succeeded', 'success'): break
    if s in ('failed', 'error', 'cancelled'): sys.exit(json.dumps(st)[:500])
for _ in range(5):
    time.sleep(5)
    code = subprocess.run(['curl', '-s', '-m', '300', '-o', out, '-w', '%{http_code}', '-H', f'Authorization: Bearer {KEY}',
                           f"{BASE}/v1/images/{j['id']}/content"], capture_output=True, text=True).stdout
    if code == '200' and ok(out):
        print('saved', out, os.path.getsize(out)); print('META', json.dumps({'id': j['id'], 'status': st})[:600]); sys.exit(0)
    time.sleep(25)
sys.exit('download failed ' + code)
