"""Source push fallback for environments without the Sites source helper.
Credential is read once from hidden stdin and passed only in the Git process environment.
"""
import sys,json,os,subprocess,termios
fd=sys.stdin.fileno();old=termios.tcgetattr(fd);new=termios.tcgetattr(fd);new[3]&=~termios.ECHO;termios.tcsetattr(fd,termios.TCSANOW,new)
print('Ready for source credential JSON on stdin (input is hidden).',flush=True)
try: credential=json.loads(sys.stdin.readline())
finally: termios.tcsetattr(fd,termios.TCSANOW,old)
env=dict(os.environ)
for key in list(env):
 if key.startswith('GIT_TRACE') or key=='GIT_CURL_VERBOSE':env.pop(key,None)
if credential.get('token'):
 env['GIT_CONFIG_COUNT']='1';env['GIT_CONFIG_KEY_0']='http.'+credential['remote_url']+'.extraHeader';env['GIT_CONFIG_VALUE_0']='Authorization: Bearer '+credential['token']
subprocess.run(['git','push',credential['remote_url'],'HEAD:'+credential['branch']],env=env,check=True)
print(json.dumps({'commit_sha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()}),flush=True)
