include:
  - project: 'ci_cd_ict_sdlc/pipelines_sot'
    file: 'GENERIC/cicd-generic-templates.yaml'

variables:
  DOCKER_HOST: tcp://localhost:2375
  DOCKER_TLS_CERTDIR: ""
  AZURE_STORAGE_ACCOUNT: sdlcsecurityreport
  AZURE_STORAGE_CONTAINER: sdlcblobstorage
  MAVEN_OPTS: '-Dcheckstyle.skip -DskipTests'
  MENARINI_ARTIFACT_REGISTRY_SERVER: europe-docker.pkg.dev
  MENARINI_ARTIFACT_REGISTRY_URL: ${MENARINI_ARTIFACT_REGISTRY_SERVER}/mgcp-sdlc-230917012
  MENARINI_ARTIFACT_REGISTRY_USER: _json_key
  REPOSITORY_URI: "${MENARINI_ARTIFACT_REGISTRY_URL}/${APP_PROJECT}/${APP_NAME}"
  APP_PROJECT: ict
  APP_NAME: mini-myportal
  MANIFEST_REPO: "global-manifest/mini-myportal-manifest"
  MANIFEST_PATH: "mini-myportal-manifest/overlays"

stages:
  - checkstyle-and-test
  - quality
  - release
  - integration

node_checkstyle:
  extends: .node_checkstyle_template
  allow_failure: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

node_test:
  extends: .node_test_template
  allow_failure: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

trivy_scan:
  extends: .trivy_scan_template
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

build_docker_image:
  extends: .build_buildah_image_template
  script:
    - buildah info
    - |
      if [[ "${CI_COMMIT_REF_NAME}" == "main" ]]; then
        TAG="prod"
      elif [[ "${CI_COMMIT_REF_NAME}" == "develop" ]]; then
        TAG="dev"
      else
        TAG="${CI_COMMIT_REF_NAME}"
      fi
    - export IMAGE_TAG="${TAG}-${CI_COMMIT_SHA:0:8}"
    - echo "Building image with tag ${IMAGE_TAG}"
    - buildah bud -t "${REPOSITORY_URI}:${IMAGE_TAG}" .
    - buildah push "${REPOSITORY_URI}:${IMAGE_TAG}"
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

manifest_integration:
  extends: .generic_manifest_integration_template
  needs:
    - build_docker_image
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
