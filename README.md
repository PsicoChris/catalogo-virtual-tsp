# Catálogo Virtual Tecnológico – Proyecto TSPi

Proyecto desarrollado para la asignatura **Desarrollo de Software en Equipo – TSP** (Institución Universitaria Politécnico Grancolombiano – Grupo B04 / Equipo 6)[cite: 6].

## Equipo de Trabajo y Roles (TSPi)
* **Jonathan Lopez** – Team Leader (TL)[cite: 6]
* **Diego Hernandez** – Planning Manager (PM)[cite: 6]
* **Christian Lancheros** – Process Manager (PrM)[cite: 6]
* **Angie Leguizamon** – Development Manager (DM)[cite: 6]
* **Ana Cristina Minu Cedeño** – Support Manager (SM)[cite: 6]
* **Diego Armando Martínez Aguirre** – Quality Manager (QM)[cite: 6]

## Módulos Funcionales
1. **Módulo de Registro e Inicio de Sesión:** Autenticación obligatoria de clientes para gestionar pedidos[cite: 2, 6].
2. **Módulo de Búsqueda Básica:** Localización rápida de artículos por nombre[cite: 2, 6].
3. **Módulo de Búsqueda Avanzada:** Filtrado combinado por categoría, rango de precio y disponibilidad[cite: 2, 12].
4. **Módulo de Artículos y Características:** Catálogo con mínimo 20 productos, control de stock y vista ampliada al hacer clic en la imagen[cite: 2, 6].
5. **Módulo de Compra por Artículo:** Selección de producto y cantidad con validación de inventario disponible[cite: 2, 6].
6. **Módulo Carro de Compras:** Resumen persistente con cantidades, subtotales (`cantidad × precio`) y total a pagar[cite: 6, 19].

## Stack Tecnológico
* **Frontend:** HTML5, CSS3, JavaScript (ES6+)[cite: 12]
* **Backend:** Node.js + Express[cite: 12]
* **Persistencia:** SQLite + Inventario base estructurado (`database/productos.json`)[cite: 12]

## Estrategia de Ramas (Git Flow TSPi)
* `main`: Versión estable y entregas oficiales[cite: 12].
* `develop`: Rama de integración (requiere revisión por al menos 2 pares / *Peer Review*)[cite: 12].
* `feature/<modulo>`: Ramas independientes para desarrollo modular[cite: 12].