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

    - name: kubectl
      image: bitnami/kubectl:latest
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
    // Set REGISTRY to your container registry host, e.g. ghcr.io/youruser or 192.168.x.x:5000
    // For a local HTTP registry add --insecure --skip-tls-verify to the kaniko executor calls below
    REGISTRY   = 'your-registry'
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
          sh 'pnpm --filter frontend run build'
          sh 'pnpm --filter frontend run test -- --watchAll=false --passWithNoTests'
          sh 'pnpm --filter backend run test'
        }
      }
    }

    stage('Build & push images') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main' }
      }
      steps {
        container('kaniko') {
          sh '''
            /kaniko/executor \
              --context "dir://$PWD" \
              --dockerfile "frontend/Dockerfile" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:${IMAGE_TAG}" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:main" \
              --cache=true
          '''
          sh '''
            /kaniko/executor \
              --context "dir://$PWD" \
              --dockerfile "backend/Dockerfile" \
              --destination "${REGISTRY}/${IMAGE_REPO}/backend:${IMAGE_TAG}" \
              --destination "${REGISTRY}/${IMAGE_REPO}/backend:main" \
              --cache=true
          '''
        }
      }
    }

    stage('Deploy') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main' }
      }
      steps {
        container('kubectl') {
          sh '''
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE}' \
              < deploy/k8s/backend.yml | kubectl apply -n "${NAMESPACE}" -f -
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE}' \
              < deploy/k8s/frontend.yml | kubectl apply -n "${NAMESPACE}" -f -
            kubectl rollout status deployment/tvkodbdi-backend  -n "${NAMESPACE}" --timeout=5m
            kubectl rollout status deployment/tvkodbdi-frontend -n "${NAMESPACE}" --timeout=5m
          '''
        }
      }
    }

  }

  post {
    success {
      echo "Deployed thetvdbkodi @ ${env.IMAGE_TAG}"
    }
    failure {
      echo 'Pipeline failed — see stage logs.'
    }
  }
}
