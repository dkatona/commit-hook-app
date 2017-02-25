from oauthlib.oauth1 import SIGNATURE_RSA
from requests_oauthlib import OAuth1Session
import json
import webbrowser
import time

key = open("yourkey.pem").read()
request_token_url = 'https://<host>/plugins/servlet/oauth/request-token'
access_token_url = 'https://<host>/plugins/servlet/oauth/access-token'
authorize_url = 'https://<host>/plugins/servlet/oauth/authorize'

oauth = OAuth1Session('consumer_key',
                      signature_type='auth_header',
                      signature_method=SIGNATURE_RSA,
                      rsa_key=key)
request_token = oauth.fetch_request_token(request_token_url)
print request_token
auth_link = '{}?oauth_token={}'.format(authorize_url, request_token['oauth_token'])
webbrowser.open(auth_link)
time.sleep(30)
# we do not have a real verifier but we need to specify one, so we just use a hardcoded value
access_token = oauth.fetch_access_token(access_token_url, verifier=u'unused')
print access_token