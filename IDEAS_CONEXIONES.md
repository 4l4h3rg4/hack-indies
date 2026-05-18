# Ideas de Conexiones para PyMEs No-Tecnológicas

Lista de servicios a los que HackIndie podría conectarse para auditar la ciberseguridad
de PyMEs cuyo negocio principal no es la tecnología (pastelerías, ferreterías, tiendas
de barrio, etc.).

---

## Prioridad Recomendada

Ordenadas por **impacto para una PyME típica latinoamericana**:

1. **WhatsApp Business** — si pierden esto, pierden el 80% de ventas
2. **Have I Been Pwned + Dominio** — bajo esfuerzo técnico, altísimo valor de alerta
3. **WooCommerce** — enorme superficie de ataque, lo usa medio mundo
4. **Google Workspace / M365** — el email es el talón de Aquiles
5. **Mercado Pago** — plata de por medio, no hay margen de error

---

## 🛒 E-commerce / Tienda Online

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Shopify** (ya implementado) | Apps instaladas con permisos excesivos, staff accounts sin 2FA, webhooks inseguros, API keys sin rotar |
| **WooCommerce / WordPress** | Plugins desactualizados, temas vulnerables, xmlrpc expuesto, admin sin 2FA, WP JSON leaking de usuarios |
| **Tiendanube** | Config de SSL, apps de terceros instaladas, permisos de staff |
| **Mercado Shops** | Exposición de datos, config de cuenta |
| **Wix** | Config de seguridad de la página, versión de apps |
| **Jumpseller** | Config de seguridad del sitio, permisos de colaboradores |
| **Empretienda** | Revisión de configuración de tienda y accesos |

## 📱 Redes Sociales del Negocio

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **WhatsApp Business API** | Quiénes son admins, 2FA activado, sesiones vinculadas activas. Crítico en LATAM: si pierden acceso al WhatsApp, pierden el negocio. |
| **Meta Business Suite (Facebook + Instagram)** | Admin roles, inicios de sesión sospechosos, apps conectadas con permisos excesivos, páginas vinculadas sin dueño claro |
| **Google Business Profile** | Quién tiene acceso de administrador, verificaciones pendientes, cambios no autorizados |

## 📧 Comunicación

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Google Workspace (Gmail empresarial)** | 2FA del dominio, forwarding rules sospechosos, passwords débiles de cuentas, apps OAuth con acceso a datos |
| **Microsoft 365** | MFA habilitado por usuario, forwarding rules anómalas, apps enterprise conectadas, SharePoint links públicos |

## 💰 Pagos / Finanzas

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Mercado Pago** | Rotación de access tokens, webhooks mal configurados, permisos de integraciones, credenciales de prueba en producción |
| **Stripe** | API keys sin rotar, webhooks sin firma, modos test/prod mezclados, restricted keys sin scope mínimo |
| **PayPal Business** | Config de seguridad de cuenta, notificaciones IPN, permisos de API |
| **Culqi / OpenPay / Conekta** | Similar a Stripe — procesadores de pago regionales muy usados en LATAM |

## 🔐 Identidad y Accesos

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Have I Been Pwned** | Verificar si emails del negocio aparecen en filtraciones. Alertar tipo: "tu correo pasteleria@tudulce.com apareció en 3 breaches, cambiá tu contraseña YA" |
| **Chequeo de Dominio (DNS)** | SPF, DKIM, DMARC configurados (anti-phishing). DNSSEC. Certificado SSL por vencer. Subdominios expuestos. |
| **Bitwarden / Gestor de Contraseñas** | Contraseñas reutilizadas, débiles, sin 2FA, vault sin backup, sharing inseguro de credenciales |

## ☁️ Almacenamiento / Documentos

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Google Drive** | Archivos compartidos públicamente sin querer, permisos "cualquiera con el link", carpetas de empleados expuestas |
| **Dropbox Business** | Links públicos activos, permisos de carpeta, dispositivos vinculados |

## 🌐 Infraestructura del Local Físico

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Router / WiFi del negocio** | Contraseña por defecto, WPS activado, firmware desactualizado, red de invitados no aislada |
| **Cámaras IP / DVR / NVR** | Contraseñas por defecto (problema enorme en PyMEs), puertos expuestos, firmware sin actualizar |
| **Impresoras de red** | Exposición de puertos, firmware obsoleto, datos en cola de impresión |

## 🗄️ Infraestructura Cloud / Backend

| Conexión | ¿Qué auditaría? |
|----------|-----------------|
| **Supabase** (ya implementado) | RLS habilitado en todas las tablas, anon key sin sobre-permisos, backups configurados, extensiones sin mantener |
| **GitHub / GitLab / Bitbucket** | Secrets expuestos en repos, branches sin protección, dependencias con CVEs (Dependabot), workflows sin revisar |
| **Vercel / Netlify** | Variables de entorno expuestas, deployments automáticos desde branches no protegidos, domains sin HTTPS |
| **Cloudflare** | Config de WAF, reglas de firewall, DNSSEC, rate limiting sin activar |
| **cPanel / Plesk / hosting compartido** | Versión de PHP obsoleta, backups inexistentes, FTP sin SFTP, bases de datos expuestas |

---

## 🔄 Ideas de Alertas Proactivas Recurrentes

Más allá de conectar servicios, ideas de chequeos que el Watcher podría hacer periódicamente:

| Alerta | Frecuencia | Descripción |
|--------|-----------|-------------|
| **Contraseñas sin rotar** | Semanal | "Tu contraseña de Shopify no la cambiás hace 6 meses. Expertos recomiendan cambiarla cada 3-6 meses." |
| **2FA faltante** | Semanal | "Tenés 3 cuentas de staff sin segundo factor de autenticación activado." |
| **CVE nuevo de tu stack** | Diario | "Salió un CVE crítico en WooCommerce 8.x. Tu versión está afectada. Actualizá YA." |
| **Dominio por vencer** | Semanal | "Tu dominio tudulce.com vence en 15 días. Renovalo para evitar que te lo compren." |
| **SSL por vencer** | Semanal | "El certificado SSL de tu tienda vence en 7 días." |
| **Filtración de datos** | En tiempo real | "El correo ventas@tudulce.com apareció en una filtración de datos (Breach: X)." |
| **Backups sin verificar** | Mensual | "No se ha verificado un backup de tu tienda en 45 días." |
| **Permisos excesivos** | Quincenal | "3 apps tienen acceso total a tu cuenta de Instagram y no las usaste en 90 días." |
| **Puertos expuestos** | Semanal | "Tu cámara IP Hikvision tiene el puerto 554 abierto a internet sin protección." |
| **SPF/DKIM/DMARC** | Mensual | "Tu dominio no tiene DMARC configurado. Cualquiera puede suplantar tus correos." |

---

## 🧩 Notas Técnicas

- Cada conexión se implementaría como un **MCP toolset** que el Inspector carga dinámicamente por sesión
- Las credenciales se encriptan con **PyNaCl (libsodium SecretBox)** antes de guardarse en `connections`
- El **Watcher** (servicio Python en background) corre los chequeos recurrentes y genera `alerts`
- Las alertas usan lenguaje **no técnico**, orientado a que un dueño de PyME entienda qué hacer sin saber de tecnología
