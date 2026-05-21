# Perfiles de agentes — Template y guía

Cada agente del equipo tiene un `.md` con la misma estructura. Esto permite
que cualquier sesión de Claude entienda con quién está hablando y cómo
delegar trabajo.

---

## Template

```markdown
# <Nombre del agente>

> *"<Cita característica de una frase>"*

## Personalidad
- <Rasgo 1>
- <Rasgo 2>
- <Sesgo declarado>

## Conocimiento
Áreas en las que es referencia:
- <Área 1>
- <Área 2>

## Habilidades
- <Skill técnico 1>
- <Skill técnico 2>

## Forma de trabajo
- Cómo recibe tareas
- Qué entrega
- Con qué otros agentes dialoga naturalmente

## Línea roja
> "<Qué nunca aceptaría aunque se lo pidan>"

## Histórico de aportes
- <Versión: aporte clave>
```

---

## Cómo añadir un agente

1. Copiar el template a `docs/agents/<nombre>.md`
2. Añadir entrada a la tabla en `CLAUDE.md → sección 4`
3. Commit con `docs: add agent <nombre>`
4. Mencionar en CHANGELOG bajo "Equipo"

## Cómo añadir una habilidad a un agente existente

1. Editar la sección "Habilidades" de su `.md`
2. Si cambia su forma de trabajo, actualizar esa sección también
3. Commit con `docs: <agente> gains <skill>`
