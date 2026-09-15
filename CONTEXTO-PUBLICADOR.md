# Contexto para la IA de la PC del negocio (E-Pyme)

Este archivo lo escribió Claude desde la Mac de Juani el 15/09/2026. Está acá porque
la memoria de Claude **no** viaja entre dispositivos: el repo sí. Si sos una IA
trabajando en la PC del negocio, esto es todo lo que necesitás saber.

---

## El cambio que hay que hacer

En esta PC hay un script que lee los precios de **SQL Server (E-Pyme)** y los publica
haciendo commit a GitHub. Hoy commitea **sólo** al repo tester. Tiene que commitear a
los dos: el tester y el oficial.

| | |
|---|---|
| Tester (hoy escribe acá) | `paladear/paladeartienda-test` |
| **Oficial (falta)** | `paladear/paladeartienda` |

Los tres archivos que escribe, y que tienen que quedar iguales en los dos repos:

| Archivo | Qué es |
|---|---|
| `precios-min.csv` | la lista de precios que lee la tienda |
| `pendientes.json` | productos nuevos y cambios de nombre |
| `comando-precios.json` | la respuesta del script al pedido del panel |

El script también **lee** `comando-precios.json` para ver si hay un pedido pendiente, y
al terminar lo reescribe con `{"estado":"hecho","terminado":...,"detalle":...}`. Ese
pedido se puede seguir leyendo del tester como ahora: lo único obligatorio es que los
tres archivos queden actualizados en los dos repos.

Los commits salen con autor `paladear <juanivelez980@gmail.com>` y la cuenta de GitHub
`Juanivelez980-lgtm`.

## Verificar ANTES de tocar nada

1. **Permiso.** `Juanivelez980-lgtm` nunca commiteó en `paladear/paladeartienda`, así que
   puede faltarle el acceso de escritura. Si falta: **pará y avisale a Juani**, se lo tiene
   que dar él desde la cuenta `paladear` (Settings → Collaborators).
2. Mostrale dónde está el script y en qué lenguaje está, antes de modificarlo.

## Lo que NO hay que tocar — esto ya se rompió una vez

- **El formato de `precios-min.csv`.** Las columnas son exactamente estas, y las dos
  primeras van vacías:

  ```
  ,,Nombre,Bt.LISTA 1,Bt.LISTA 2,Rubro,Artículo
  ```

  Los precios van con punto de miles y coma de decimales, entre comillas: `"4.070,00"`.
  Si eso cambia, la tienda lee los precios **mil veces más baratos**. Ya pasó.

- La consulta a SQL Server y la lógica de qué productos entran.
- La estructura de `pendientes.json` y de `comando-precios.json`.
- El horario o la forma en que se dispara el script.
- **Cualquier otro archivo de los repos.** En particular `index.html`, `admin.html` y
  `catalogo-panel.json`: esos los maneja Juani desde la Mac y se pisarían. El script
  toca únicamente los tres archivos de la tabla de arriba.

## Cómo probar que quedó bien

Corré el script una vez y comprobá que en los dos repos el `precios-min.csv` tenga el
mismo contenido y la misma cantidad de productos. Al 15/09/2026 son **544**.

```bash
curl -s https://paladear.github.io/paladeartienda-test/precios-min.csv -o /tmp/a.csv
curl -s https://paladear.github.io/paladeartienda/precios-min.csv -o /tmp/b.csv
cmp /tmp/a.csv /tmp/b.csv && echo "IGUALES" || echo "DISTINTOS"
wc -l /tmp/a.csv /tmp/b.csv
```

GitHub Pages tarda **entre 1 y 2 minutos** en publicar, así que esperá antes de comparar.

Si el commit al oficial falla, decile el error exacto a Juani y **dejá el del tester
funcionando como estaba**.

## Por qué esto es urgente

Los precios de la tienda oficial **no se están actualizando solos**. Hoy están al día de
casualidad: alguien copió el tester completo al oficial el 15/09 a la 01:14, y desde
entonces E-Pyme no cambió ningún precio. En cuanto cambie uno de verdad, el tester se
actualiza y **la tienda oficial se queda con precios viejos**.

## Contexto de fondo (no hace falta tocarlo)

- Las dos tiendas son un solo `index.html` estático servido por GitHub Pages.
  Minorista: `paladear/paladeartienda`. Distribuidora: `paladear/paladeardistribuidora`.
- El panel de administración es `admin.html` en el mismo repo. Desde ahí Juani edita
  nombres, fotos, marcas, cantidades y sabores; eso se guarda en `catalogo-panel.json`.
- Los **precios y el rubro** vienen siempre de E-Pyme y no se editan en el panel. Todo lo
  demás lo manda el panel.
- El Google Sheet que se usaba antes está desconectado. E-Pyme es la única fuente de
  precios.
- Hay un GitHub Action (`update-products.yml`) que sólo regenera `sitemap.xml` y
  `sitemap.txt`. Ya **no** escribe precios: no esperes que él arregle esto.
- Juani habla español (Mendoza, Argentina) y publica desde el editor web de GitHub.
  Prefiere cambios chicos y dirigidos, no reescrituras. Mostrale el diff antes de
  commitear.
