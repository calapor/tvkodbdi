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
        limits:   { cpu: "2",    memory: "3Gi" }

    - name: kubectl
      image: bitnami/kubectl:latest
      command: ["sleep"]
      args: ["infinity"]
      # run as root so durable-task can write the workspace @tmp control files
      # (bitnami/kubectl defaults to UID 1001; node/kaniko already run as root)
      securityContext:
        runAsUser: 0
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
    NAMESPACE           = "${env.NAMESPACE ?: 'default'}"
    KANIKO_EXTRA_ARGS   = "${env.KANIKO_EXTRA_ARGS ?: ''}"
    // surface the build parameters as env vars so the kaniko sh block can read them
    SHOW_DOWNLOADED_COL = "${params.REACT_APP_SHOW_DOWNLOADED_COL}"
    SEARCH_LINK_1       = "${params.REACT_APP_SEARCH_LINK_1}"
    SEARCH_LINK_2       = "${params.REACT_APP_SEARCH_LINK_2}"
    DEPLOY_DEMO         = "${params.DEPLOY_DEMO}"
  }

  parameters {
    booleanParam(
      name: 'REACT_APP_SHOW_DOWNLOADED_COL',
      defaultValue: false,
      description: 'Show the Downloaded column in the frontend'
    )
    string(
      name: 'REACT_APP_SEARCH_LINK_1',
      defaultValue: 'http://localhost/search.php?q=',
      description: 'First search URL toggled by double-clicking a table'
    )
    string(
      name: 'REACT_APP_SEARCH_LINK_2',
      defaultValue: 'http://127.0.0.1/search.php?q=',
      description: 'Second search URL toggled by double-clicking a table'
    )
    booleanParam(
      name: 'DEPLOY_DEMO',
      defaultValue: true,
      description: 'Build and deploy a second demo instance (static data, no Kodi/TVDB calls) on port 30091'
    )
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

    stage('Prepare deployment vars') {
      steps {
        script {
            env.FRONTEND_CONFIG_HASH = sh(
                script: '''
                    echo -n "${REACT_APP_SHOW_DOWNLOADED_COL}|${REACT_APP_SEARCH_LINK_1}|${REACT_APP_SEARCH_LINK_2}" | sha256sum | cut -d' ' -f1
                ''',
                returnStdout: true
            ).trim()
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
          // CI=false so react-scripts does not promote ESLint warnings to errors
          // (Jenkins sets CI=true); the image build (Docker/kaniko) builds the same way.
          sh 'CI=false pnpm --filter ./frontend run build'
          sh 'CI=true pnpm --filter ./frontend exec react-scripts test --watchAll=false --passWithNoTests'
          sh 'pnpm --filter ./backend run test'
        }
      }
    }

    stage('Build & push Backend image') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main' }
      }
      steps {
        container('kaniko') {
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

    stage('Build & push Frontend image') {
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
              --build-arg "REACT_APP_SHOW_DOWNLOADED_COL=${SHOW_DOWNLOADED_COL}" \
              --build-arg "REACT_APP_SEARCH_LINK_1=${SEARCH_LINK_1}" \
              --build-arg "REACT_APP_SEARCH_LINK_2=${SEARCH_LINK_2}" \
              --build-arg "REACT_APP_VERSION=${IMAGE_TAG} (#${BUILD_NUMBER})" \
              --cache=true --compressed-caching=false --snapshot-mode=redo ${KANIKO_EXTRA_ARGS}
          '''
        }
      }
    }

    stage('Deploy Backend') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main' }
      }
      steps {
        container('kubectl') {
          sh '''
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE}' \
              < deploy/k8s/backend.yml | kubectl apply -n "${NAMESPACE}" -f -
            kubectl rollout status deployment/tvkodbdi-backend  -n "${NAMESPACE}" --timeout=30m
          '''
        }
      }
    }

  stage('Deploy Frontend') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main' }
      }
      steps {
        container('kubectl') {
          sh '''
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE} ${FRONTEND_CONFIG_HASH}' \
              < deploy/k8s/frontend.yml | kubectl apply -n "${NAMESPACE}" -f -
            kubectl rollout status deployment/tvkodbdi-frontend -n "${NAMESPACE}" --timeout=30m
          '''
        }
      }
    }

    stage('Build & push Frontend Demo image') {
      when {
        expression { params.DEPLOY_DEMO == true && (env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main') }
      }
      steps {
        container('kaniko') {
          sh '''
            /kaniko/executor \
              --context "dir://$PWD/frontend" \
              --dockerfile "Dockerfile" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:${IMAGE_TAG}-demo" \
              --destination "${REGISTRY}/${IMAGE_REPO}/frontend:main-demo" \
              --build-arg "REACT_APP_DEMO=true" \
              --build-arg "NGINX_CONF=nginx-demo.conf" \
              --build-arg "REACT_APP_SHOW_DOWNLOADED_COL=${SHOW_DOWNLOADED_COL}" \
              --build-arg "REACT_APP_SEARCH_LINK_1=${SEARCH_LINK_1}" \
              --build-arg "REACT_APP_SEARCH_LINK_2=${SEARCH_LINK_2}" \
              --build-arg "REACT_APP_VERSION=${IMAGE_TAG} (#${BUILD_NUMBER}) demo" \
              --no-push=false --snapshot-mode=redo ${KANIKO_EXTRA_ARGS}
          '''
        }
      }
    }

    stage('Deploy Backend Demo') {
      when {
        expression { params.DEPLOY_DEMO == true && (env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main') }
      }
      steps {
        container('kubectl') {
          sh '''
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE}' \
              < deploy/k8s/backend-demo.yml | kubectl apply -n "${NAMESPACE}" -f -
            kubectl rollout status deployment/tvkodbdi-demo-backend -n "${NAMESPACE}" --timeout=30m
          '''
        }
      }
    }

    stage('Deploy Frontend Demo') {
      when {
        expression { params.DEPLOY_DEMO == true && (env.GIT_BRANCH?.endsWith('/main') || env.BRANCH_NAME == 'main') }
      }
      steps {
        container('kubectl') {
          sh '''
            envsubst '${REGISTRY} ${IMAGE_REPO} ${IMAGE_TAG} ${NAMESPACE}' \
              < deploy/k8s/frontend-demo.yml | kubectl apply -n "${NAMESPACE}" -f -
            kubectl rollout status deployment/tvkodbdi-demo-frontend -n "${NAMESPACE}" --timeout=30m
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
