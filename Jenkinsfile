pipeline {
  agent {
    kubernetes {
      defaultContainer 'node'
      yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  securityContext:
    fsGroup: 1000
  containers:
    - name: node
      image: node:22-bookworm
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "500m", memory: "1Gi" }
        limits:   { cpu: "2",    memory: "2Gi" }

    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "500m", memory: "1Gi" }
        limits:   { cpu: "2",    memory: "2.5Gi" }

    - name: helm
      image: alpine/helm:3.16.3
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "100m", memory: "128Mi" }
        limits:   { cpu: "500m", memory: "256Mi" }
'''
    }
  }

  options {
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
  }

  environment {
    // In-cluster registry addressed by the cluster IP + NodePort (HTTP/insecure).
    // The same ref works for Kaniko (in-cluster) and the kubelet pull; nodes need a
    // one-time, project-agnostic insecure-registry entry (see specs/jenkins-setup.md).
    REGISTRY   = '192.168.1.101:30500'
    IMAGE_REPO = 'thetvdbkodi'
    NAMESPACE  = 'thetvdbkodi'
  }

  stages {

    stage('Setup') {
      steps {
        container('node') {
          sh 'git config --global --add safe.directory "$WORKSPACE"'

          script {
            env.IMAGE_TAG = sh(
              returnStdout: true,
              script: 'git rev-parse --short HEAD'
            ).trim()
          }

          sh 'corepack enable && corepack prepare pnpm@11.1.1 --activate'
        }
      }
    }


    stage('Debug Branch') {
      steps {
        container('node') {
          sh '''
            echo "BRANCH_NAME=${BRANCH_NAME}"
            echo "GIT_BRANCH=${GIT_BRANCH}"
            echo "WORKSPACE=${WORKSPACE}"

            git config --global --add safe.directory "$WORKSPACE"

            echo "Current branch:"
            git rev-parse --abbrev-ref HEAD

            echo "Current commit:"
            git rev-parse HEAD
          '''
        }

      }
    }



    stage('Install') {
      steps {
        container('node') {
          sh 'pnpm install --frozen-lockfile'
        }
      }
    }

    stage('Verify') {
      steps {
        container('node') {
          sh 'pnpm -r lint'
          sh 'pnpm -r typecheck'
          sh 'pnpm -r test'
          sh 'pnpm -r build'
        }
      }
    }

    stage('Build & push images') {
      when {
        expression {
          env.GIT_BRANCH?.endsWith('/main')
        }
      }
      steps {
        container('kaniko') {
          sh '''
            for app in web worker; do
              /kaniko/executor \
                --context "dir://$PWD" \
                --dockerfile "deploy/docker/${app}.Dockerfile" \
                --destination "${REGISTRY}/${IMAGE_REPO}/${app}:${IMAGE_TAG}" \
                --destination "${REGISTRY}/${IMAGE_REPO}/${app}:main" \
                --insecure --skip-tls-verify --cache=true
            done
          '''
        }
      }
    }

    stage('Deploy') {
      when {
        expression {
          env.GIT_BRANCH?.endsWith('/main')
        }
      }
      steps {
        container('helm') {
          sh '''
            helm upgrade --install thetvdbkodi deploy/helm/thetvdbkodi \
              --namespace "${NAMESPACE}" --create-namespace \
              --set image.registry="${REGISTRY}" \
              --set image.repository="${IMAGE_REPO}" \
              --set image.tag="${IMAGE_TAG}" \
              --set ingress.enabled=false \
              --wait --timeout 40m
          '''
        }
      }
    }

  }

  post {
    success {
      echo "Deployed pricecheck @ ${env.IMAGE_TAG}"
    }

    failure {
      echo 'Pipeline failed — see stage logs.'
    }
  }
}
