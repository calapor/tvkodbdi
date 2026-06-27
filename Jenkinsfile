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
    # jnlp pinned with a small request; the cluster is memory-constrained
    # (~3.7Gi/node) so requests are kept low to let the agent pod schedule.
    - name: jnlp
      resources:
        requests: { cpu: "100m", memory: "256Mi" }
        limits:   { cpu: "500m", memory: "512Mi" }

    - name: node
      image: node:22-bookworm
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "250m", memory: "640Mi" }
        limits:   { cpu: "2",    memory: "2Gi" }

    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "250m", memory: "256Mi" }
        limits:   { cpu: "2",    memory: "2Gi" }

    - name: kubectl
      image: bitnami/kubectl:latest
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "50m",  memory: "64Mi" }
        limits:   { cpu: "500m", memory: "256Mi" }
'''
    }
  }

  options {
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
  }

  environment {
    // Defaults are placeholders for public use; override REGISTRY / NAMESPACE / KANIKO_EXTRA_ARGS
    // via Jenkins global env (Manage Jenkins > System > Global properties).
    // For a local HTTP registry set KANIKO_EXTRA_ARGS='--insecure --skip-tls-verify --insecure-pull'.
    REGISTRY            = "${env.REGISTRY ?: 'your-registry'}"
    IMAGE_REPO          = 'thetvdbkodi'
    NAMESPACE           = "${env.NAMESPACE ?: 'thetvdbkodi'}"
    KANIKO_EXTRA_ARGS   = "${env.KANIKO_EXTRA_ARGS ?: ''}"
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
          // CI=false so react-scripts does not promote ESLint warnings to errors
          // (Jenkins sets CI=true); the image build (Docker/kaniko) builds the same way.
          sh 'CI=false pnpm --filter ./frontend run build'
          sh 'CI=true pnpm --filter ./frontend exec react-scripts test --watchAll=false --passWithNoTests'
          sh 'pnpm --filter ./backend run test'
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
              --context "dir://$PWD/frontend" \
              --dockerfile "Dockerfile" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:${IMAGE_TAG}" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:main" \
              --cache=true ${KANIKO_EXTRA_ARGS}
          '''
          sh '''
            /kaniko/executor \
              --context "dir://$PWD/backend" \
              --dockerfile "Dockerfile" \
              --destination "${REGISTRY}/${IMAGE_REPO}/backend:${IMAGE_TAG}" \
              --destination "${REGISTRY}/${IMAGE_REPO}/backend:main" \
              --cache=true ${KANIKO_EXTRA_ARGS}
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
