pipeline {
    agent any

    environment {
        AWS_REGION = 'eu-central-1'
        CODEBUILD_PROJECT = 't2data-fastapi-build'
    }

    stages {

        stage('Trigger AWS CodeBuild') {
            steps {
                script {
                    echo " Starting AWS CodeBuild Project: ${CODEBUILD_PROJECT}"

                    // Start the CodeBuild project
                    def buildId = sh(
                        script: """
                            aws codebuild start-build \
                            --project-name ${CODEBUILD_PROJECT} \
                            --region ${AWS_REGION} \
                            --query 'build.id' \
                            --output text
                        """,
                        returnStdout: true
                    ).trim()

                    echo " Build started: ${buildId}"

                    // Poll CodeBuild status every 10 seconds
                    timeout(time: 30, unit: 'MINUTES') {
                        waitUntil {
                            def status = sh(
                                script: """
                                    aws codebuild batch-get-builds \
                                    --ids ${buildId} \
                                    --region ${AWS_REGION} \
                                    --query 'builds[0].buildStatus' \
                                    --output text
                                """,
                                returnStdout: true
                            ).trim()

                            echo " Current Status: ${status}"

                            if (status == 'IN_PROGRESS' || status == 'QUEUED') {
                                sleep 10
                                return false
                            }

                            if (status == 'SUCCEEDED') {
                                echo " CodeBuild completed successfully!"
                                return true
                            }

                            error " CodeBuild failed: ${status}"
                        }
                    }
                }
            }
        }
    }
}
