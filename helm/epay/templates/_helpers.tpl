{{/* Base name, overridable. */}}
{{- define "epay.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "epay.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "epay.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "epay.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "epay.labels" -}}
helm.sh/chart: {{ include "epay.chart" . }}
app.kubernetes.io/name: {{ include "epay.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: epay
{{- end -}}

{{- define "epay.selectorLabels" -}}
app.kubernetes.io/name: {{ include "epay.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Resolve an image reference.
  .root    — the top-level template context (for .Values / .Chart)
  .image   — the per-component image block
  .app     — used in error messages only

When .image.digest is set it always wins (immutable reference). When it is not
set and global.requireDigest is true, rendering fails loudly rather than silently
deploying a mutable tag.
*/}}
{{- define "epay.image" -}}
{{- $root := .root -}}
{{- $img := .image -}}
{{- $repo := $img.repository -}}
{{- if $root.Values.global.registry -}}
{{- $repo = printf "%s/%s" $root.Values.global.registry $img.repository -}}
{{- end -}}
{{- if $img.digest -}}
{{- printf "%s@%s" $repo $img.digest -}}
{{- else if $root.Values.global.requireDigest -}}
{{- fail (printf "global.requireDigest is true but no digest is set for image %q. Pin it: docker buildx imagetools inspect <image> --format '{{ .Manifest.Digest }}'" $img.repository) -}}
{{- else -}}
{{- printf "%s:%s" $repo ($img.tag | default $root.Chart.AppVersion) -}}
{{- end -}}
{{- end -}}

{{/* Pod-level security context. */}}
{{- define "epay.podSecurityContext" -}}
runAsNonRoot: {{ .Values.securityContext.runAsNonRoot }}
runAsUser: {{ .Values.securityContext.runAsUser }}
fsGroup: {{ .Values.securityContext.fsGroup }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* Container-level security context. */}}
{{- define "epay.containerSecurityContext" -}}
allowPrivilegeEscalation: {{ .Values.securityContext.allowPrivilegeEscalation }}
readOnlyRootFilesystem: {{ .Values.securityContext.readOnlyRootFilesystem }}
capabilities:
  drop:
{{- range .Values.securityContext.capabilities.drop }}
    - {{ . }}
{{- end }}
{{- end -}}

{{/* Name of the Secret holding DATABASE_URL / JWT_SECRET / etc. */}}
{{- define "epay.appSecretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-app" (include "epay.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Name of the Postgres auth Secret. */}}
{{- define "epay.postgresSecretName" -}}
{{- .Values.postgres.auth.existingSecret | default (printf "%s-postgres" (include "epay.fullname" .)) -}}
{{- end -}}

{{- define "epay.postgresHost" -}}
{{- printf "%s-postgres" (include "epay.fullname" .) -}}
{{- end -}}
