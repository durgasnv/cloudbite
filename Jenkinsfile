pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    // A multibranch job can also use GitHub webhooks for push and PR builds.
    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Source Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm ci'
                    } else {
                        bat 'npm ci'
                    }
                }
            }
        }

        stage('Code Quality') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm run check'
                    } else {
                        bat 'npm run check'
                    }
                }
            }
        }

        stage('Automated Tests') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm test'
                    } else {
                        bat 'npm test'
                    }
                }
            }
        }

        stage('Dependency Security Scan') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm audit --audit-level=high --omit=dev'
                    } else {
                        bat 'npm audit --audit-level=high --omit=dev'
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'CloudBite CI checks passed.'
        }
        failure {
            echo 'CloudBite CI checks failed; review the failed stage.'
        }
    }
}
