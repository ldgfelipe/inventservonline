-- ============================================================
--  Migracion 008: descripciones de los giros
--
--  Cada giro explica a que se dedica y que campos pediran sus
--  productos. Asi quien se registra elige bien y sabe que le espera.
-- ============================================================

alter table public.giros
  add column if not exists descripcion text;

-- Construccion y Farmacia conservan sus campos especificos
update public.giros set descripcion = 'Obras, remodelaciones y venta de materiales. Pide material, espesor y proveedor del material.'
  where nombre = 'Construccion';
update public.giros set descripcion = 'Farmacias y droguerias. Pide principio activo, lote, vencimiento y si requiere receta.'
  where nombre = 'Farmacia';

update public.giros set descripcion = 'Tornilleria, herramientas y articulos de ferreteria en general.' where nombre = 'Ferreteria';
update public.giros set descripcion = 'Cemento, arena, cabilla, blocks y similares para la construccion.' where nombre = 'Materiales de construccion';
update public.giros set descripcion = 'Venta de comida, bebidas y productos de consumo diario.' where nombre = 'Alimentos y bebidas';
update public.giros set descripcion = 'Tiendas de barrio, abastos y mini mercados.' where nombre = 'Supermercado y abastos';
update public.giros set descripcion = 'Restaurantes, cafeterias y sitios de comida.' where nombre = 'Restaurante y cafeteria';
update public.giros set descripcion = 'Panes, dulces, tortas y reposteria.' where nombre = 'Panaderia y pasteleria';
update public.giros set descripcion = 'Ropa, calzado, bolsos y accesorios.' where nombre = 'Ropa, calzado y accesorios';
update public.giros set descripcion = 'Cosmeticos, perfumeria y productos de cuidado personal.' where nombre = 'Belleza y cuidado personal';
update public.giros set descripcion = 'Salones de belleza, barberias y servicios de estetica.' where nombre = 'Salon de belleza y barberia';
update public.giros set descripcion = 'Celulares, computadoras, electrodomesticos y accesorios.' where nombre = 'Electronica y tecnologia';
update public.giros set descripcion = 'Repuestos para vehiculos, lubricantes y accesorios automotrices.' where nombre = 'Repuestos y automotriz';
update public.giros set descripcion = 'Muebles para el hogar y la oficina, decoracion.' where nombre = 'Muebles y decoracion';
update public.giros set descripcion = 'Juguetes, ropa infantil y articulos para bebes.' where nombre = 'Jugueteria y articulos infantiles';
update public.giros set descripcion = 'Utiles de oficina, papeles, tintas y articulos escolares.' where nombre = 'Papeleria y oficina';
update public.giros set descripcion = 'Productos de limpieza, desinfeccion y aseo.' where nombre = 'Limpieza y desinfeccion';
update public.giros set descripcion = 'Semillas, fertilizantes, agroquimicos y insumos del campo.' where nombre = 'Agropecuaria e insumos';
update public.giros set descripcion = 'Veterinarias, alimentos y accesorios para mascotas.' where nombre = 'Veterinaria y mascotas';
update public.giros set descripcion = 'Consultorios, clinicas y productos medicos.' where nombre = 'Clinica y consultorio';
update public.giros set descripcion = 'Consultorios odontologicos e insumos dentales.' where nombre = 'Odontologia';
update public.giros set descripcion = 'Opticas, monturas y lentes de contacto.' where nombre = 'Optica';
update public.giros set descripcion = 'Laboratorios clinicos y reactivos.' where nombre = 'Laboratorio';
update public.giros set descripcion = 'Gimnasios y venta de articulos deportivos.' where nombre = 'Gimnasio y deporte';
update public.giros set descripcion = 'Lavanderias, tintorerias y servicios de lavado.' where nombre = 'Lavanderia y tintoreria';
update public.giros set descripcion = 'Hoteles, posadas y servicios de hospedaje.' where nombre = 'Hoteleria';
update public.giros set descripcion = 'Transporte de carga, mensajeria y logistica.' where nombre = 'Transporte y logistica';
update public.giros set descripcion = 'Distribucion al mayor de cualquier tipo de producto.' where nombre = 'Distribuidora y mayorista';
update public.giros set descripcion = 'Servicios profesionales y consultorias.' where nombre = 'Servicios profesionales';
update public.giros set descripcion = 'Si tu negocio no aparece en la lista, elige esta opcion y configura tus propios campos despues.'
  where nombre = 'Otro';
