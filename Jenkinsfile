pipeline {
    // Docker and Minikube must share this Linux host and Minikube profile.
    agent { label 'cloudbite-release' }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Source Checkout') {
            steps { checkout scm }
        }

        stage('Install Dependencies') {
            steps { sh 'npm ci' }
        }

        stage('Code Quality') {
            steps { sh 'npm run check' }
        }

        stage('Automated Tests') {
            steps { sh 'npm test' }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube') {
                        sh "\"${scannerHome}/bin/sonar-scanner\""
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Secret Scan') {
            steps { sh 'gitleaks git --redact --exit-code 1 .' }
        }

        stage('Dependency Security Scan') {
            steps { sh 'npm audit --audit-level=high' }
        }

        stage('Build Images') {
            steps {
                script {
                    env.BACKEND_IMAGE = "cloudbite-backend:${env.BUILD_NUMBER}"
                    env.FRONTEND_IMAGE = "cloudbite-frontend:${env.BUILD_NUMBER}"
                }
                sh '''
                    docker build -f docker/backend.Dockerfile -t "$BACKEND_IMAGE" .
                    docker build -f docker/frontend.Dockerfile -t "$FRONTEND_IMAGE" .
                '''
            }
        }

        stage('Image Vulnerability Scan') {
            steps {
                sh '''
                    trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 "$BACKEND_IMAGE"
                    trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 "$FRONTEND_IMAGE"
                '''
            }
        }

        stage('Security Gate') {
            steps { echo 'Quality, secret, dependency, and both image scans passed.' }
        }

        stage('Deploy to Minikube') {
            when { branch 'main' }
            steps {
                withCredentials([file(credentialsId: 'cloudbite-kubeconfig', variable: 'KUBECONFIG')]) {
                    sh 'bash scripts/deploy-minikube.sh'
                }
            }
        }
    }

    post {
        success { echo 'CloudBite checks passed. Only main-branch builds deploy.' }
        failure { echo 'CloudBite pipeline failed; review the failed stage and deployment status.' }
    }
}
