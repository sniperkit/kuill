#!/bin/sh
MINIKUBE_OPTIONS=${MINIKUBE_OPTIONS:-}

status=$(minikube status)
if [ -z "$(echo $status | grep 'minikube: Running')" ]; then
  echo "Launching minikube cluster..."
  ${MINIKUBE_SUDO} minikube start ${MINIKUBE_OPTIONS} \
   --kubernetes-version v1.8.0 \
    --extra-config apiserver.Authorization.Mode=RBAC \
    --extra-config apiserver.Authentication.RequestHeader.AllowedNames=auth-proxy \
    --extra-config apiserver.Authentication.RequestHeader.ClientCAFile=/var/lib/localkube/certs/ca.crt \
    --extra-config apiserver.Authentication.RequestHeader.UsernameHeaders=X-Remote-User \
    --extra-config apiserver.Authentication.RequestHeader.GroupHeaders=X-Remote-Group \
    --extra-config apiserver.Authentication.RequestHeader.ExtraHeaderPrefixes=X-Remote-Extra- \
    --extra-config apiserver.Audit.LogOptions.Path=/var/log/apiserver-audit.log \
    --extra-config apiserver.Audit.LogOptions.MaxAge=1 \
    --extra-config apiserver.Audit.LogOptions.MaxSize=50 \
    --extra-config apiserver.Audit.LogOptions.MaxBackups=5 \
    --v=4
fi

minikube update-context

JSONPATH='{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}'
until kubectl get nodes -o jsonpath="$JSONPATH" 2>&1 | grep -q "Ready=True"; do 
  printf "Waiting for minikube: %s" "$(kubectl get nodes -o jsonpath="$JSONPATH" 2>&1)"
  sleep 2; 
done


echo "Waiting for minikube apiserver..."
apiserver=$(kubectl config view --flatten --minify -o json | jq -r '.clusters[0].cluster.server')
while ! curl -skL --fail "${apiserver}/healthz"; do sleep 2; done

echo "Creating cluster role binding for kube-system serviceaccount"
kubectl create clusterrolebinding kube-system-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default

if ! kubectl --context minikube get secret auth-proxy-certs; then

  mkdir -p ~/.minikube/certs/auth-proxy && rm -rf ~/.minikube/certs/auth-proxy/*

  if [ -e /var/lib/localkube/certs/ca.key ]; then
    echo "Copying minikube certs from localkube certs..."
    sudo cat /var/lib/localkube/certs/ca.key > ~/.minikube/certs/auth-proxy/ca.key
    sudo cat /var/lib/localkube/certs/ca.crt > ~/.minikube/certs/auth-proxy/ca.crt
  else
    echo "Copying minikube certs from vm..."
    while ! minikube ssh 'true'; do sleep 5; done
    minikube ssh 'sudo cat /var/lib/localkube/certs/ca.key' > ~/.minikube/certs/auth-proxy/ca.key
    minikube ssh 'sudo cat /var/lib/localkube/certs/ca.crt' > ~/.minikube/certs/auth-proxy/ca.crt
  fi

  echo "Certs in ~/.minikube/certs/auth-proxy/ :"
  ls -la ~/.minikube/certs/auth-proxy/


  echo "Generating auth proxy certs..."
  docker run --rm \
    -v ~/.minikube/certs/auth-proxy:/certs/auth-proxy \
    -w /certs/auth-proxy --entrypoint sh cfssl/cfssl \
    -c 'echo "{\"signing\":{\"default\":{\"expiry\":\"43800h\",\"usages\":[\"signing\",\"key encipherment\",\"server auth\",\"client auth\"]}}}" > /ca-config.json && \
      echo "{\"CN\":\"auth-proxy\",\"hosts\":[\"\"],\"key\":{\"algo\":\"rsa\",\"size\":2048}}" | \
      cfssl gencert -ca /certs/auth-proxy/ca.crt -ca-key /certs/auth-proxy/ca.key -config /ca-config.json - | \
      cfssljson -bare auth-proxy - && rm -f auth-proxy.csr && rm -f ca.key && mv ca.crt ca.pem'

  echo "Certs in ~/.minikube/certs/auth-proxy/ (after generation):"
  ls -la ~/.minikube/certs/auth-proxy/

  if [ "$(ls -l ~/.minikube/certs/auth-proxy/auth-proxy.pem | awk '{print $3}')" != "$(id -u $USER)" ]; then
    ${MINIKUBE_SUDO} chown -R $(id -u $USER):$(id -g $USER) ~/.minikube/certs/auth-proxy/
  fi

  echo "Creating kube secret for auth proxy certs..."
  ${MINIKUBE_SUDO} kubectl --context minikube create secret generic auth-proxy-certs \
    --from-file  ~/.minikube/certs/auth-proxy -n kube-system
fi

if [ "$1" != "nodeploy" ]; then
  curl -sL https://raw.githubusercontent.com/matt-deboer/kuill/master/hack/deploy/kuill-minikube.yml | \
        kubectl --context minikube apply -f -

  while ! curl -skL --fail "https://$(minikube ip):30443/"; do sleep 2; done

  open "https://$(minikube ip):30443/"

fi