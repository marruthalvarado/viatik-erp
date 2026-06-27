# SERVICES

## Objetivo

Toda comunicación con Supabase debe pasar por Services.

---

# Arquitectura

Pantalla

↓

Hook

↓

Service

↓

CRUD Factory

↓

Supabase

---

# Reglas

Nunca llamar Supabase desde:

- Componentes
- Formularios
- Pages
- Layouts

Siempre desde Services.

---

# CRUD Factory

El proyecto ya dispone de una CRUD Factory.

Todos los nuevos servicios deben reutilizarla.

Nunca crear otra Factory.

---

# Cada Service debe contener únicamente:

- create()
- update()
- delete()
- getById()
- list()

Toda lógica compleja debe permanecer en Services.

---

# Multiempresa

Todos los Services deben respetar empresa_id.

Nunca devolver registros de otra empresa.

---

# Errores

Los Services lanzan errores.

No muestran mensajes.

La UI decide cómo presentarlos.

---

# Objetivo

Centralizar completamente el acceso a datos.