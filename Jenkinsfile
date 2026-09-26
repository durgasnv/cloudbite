pipeline {
    agent any

    stages {

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                bat 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                echo 'Running automated tests...'
                bat 'npm test'
            }
        }

        stage('Security Audit') {
            steps {
                echo 'Checking dependencies for high-severity vulnerabilities...'
                bat 'npm audit --audit-level=high'
            }
        }
    }

    post {
        success {
            echo 'CI Pipeline completed successfully!'
        }

        failure {
            echo 'CI Pipeline failed. Check the logs.'
        }
    }
}