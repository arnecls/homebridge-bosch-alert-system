
<p>

<img src="docs/homebridge.png" width="150" style="vertical-align: middle; margin-right: 20px">
<img src="docs/bsh.png" width="150" style="vertical-align: middle">

</p>


# Homebridge Bosch Alerting system

This plugin exposes the Bosch smarthome alerting (intrusion) system to Homekit.

## Prerequisites

The Smarthome API uses mutual TLS to protect itself from unwanted access.  
This requires you to authenticate the plugin before it can be used.  
To do so, several steps need to be executed.

These steps have been derived from the [Bosch API docs](https://github.com/BoschSmartHome/bosch-shc-api-docs/tree/master/postman).


1. You need to create an RSA key pair, that will identifiy your client.

  ```bash
  openssl req -x509 -nodes -days 9999 -newkey rsa:2048 -keyout client-key.pem -out client-cert.pem
  ```

2. Find out your Smarthome controller IP. Test it with the following command
   
  ```bash
  CONTROLLER_IP=192.168.0.10
  curl -sk "https://${CONTROLLER_IP}:8446/smarthome/public/information"
  ```

3. Generate a client request file named `request.json` using your editor of choice

   ```json
   {
       "@type": "client",
       "id": "oss_homebridge",
       "name": "OSS Homebridge plugin",
       "primaryRole": "ROLE_RESTRICTED_CLIENT",
       "certificate": "insert the content of client-cert.pem here"
   }
   ```
4. Press the paring button on your Smarthome controller
5. Pair with the controller

  ```bash
  CONTROLLER_IP=192.168.0.10

  curl -sk -X POST \
    -H "Content-Type: application/json" \
    -H "api-version: 2.1" \
    -H "Systempassword: $(echo 'insert controller password here' | base64)" \
    -d @request.json \
    "https://${CONTROLLER_IP}:8443/smarthome/clients"
  ```

  This call will return a JSON object with "certificate" containing the signed client certificate.
  If you have `jq` is installed on your system, you can use it to directly store the certificate to a file.

  ```bash
  curl -sk -X POST ... | jq -r '.certificate' > signed-client-cert.pem
  ```

Store the client key and signed certificate in a safe location.
You will need to pass the certificate and client key to the plugin.