const fs=require('fs'); const src=fs.readFileSync(__dirname+'/modulo_pap.js','utf8');
// Stubs mínimos del entorno de la app
const ctx = `
let configNegocio={tipo_negocio:'papeleria'}, carrito=[], productosCache=[], negocioId='n', enLinea=false;
const lsGet=()=>null, lsSet=()=>{}; const jsAttr=x=>JSON.stringify(x);
`;
const f = new Function(ctx+src.replace(/cargarCachePap\(\);\s*$/,'')+`
return {precioUnitPap,subLinea,fmtPU,contarPorPeso,coincideBusqueda,limitarListaPap,stockTxt,
 set(p,v){presCache=p;volCache=v;}, setCarrito(c,p){carrito=c;productosCache=p;}, repriceCarritoPap, getCarrito:()=>carrito};`)();
let ok=0,fail=0; const eq=(n,a,b)=>{ if(JSON.stringify(a)===JSON.stringify(b)){ok++;}else{fail++;console.log('FALLA',n,a,b);} };
const hoja={id:'h',nombre:'Hoja blanca carta',precio:0.17,stock:342,unidad:'hoja',paso_venta:1};
f.set(new Map([['h',[{nombre:'Paquete',unidades:100,precio:15},{nombre:'Resma',unidades:500,precio:null}]]]),
      new Map([['h',[{desde:1000,pu:0.12}]]]));
eq('1 hoja',f.precioUnitPap(hoja,1),0.17);
eq('99 hojas sin escalón',f.precioUnitPap(hoja,99),0.17);
eq('100 = paquete a $15 → 0.15 c/u',f.precioUnitPap(hoja,100),0.15);
eq('subtotal 100 = $15.00',f.subLinea({precio:f.precioUnitPap(hoja,100),cantidad:100}),15);
eq('250 hojas = 250×0.15',f.subLinea({precio:f.precioUnitPap(hoja,250),cantidad:250}),37.5);
eq('1000 → mayoreo 0.12',f.precioUnitPap(hoja,1000),0.12);
// $79 por 500 (0.158 exacto, no 0.16)
const p2={id:'q',nombre:'Hoja',precio:0.16,stock:5000}; f.set(new Map([['q',[{nombre:'Resma',unidades:500,precio:79}]]]),new Map());
eq('resma $79 exacta',f.subLinea({precio:f.precioUnitPap(p2,500),cantidad:500}),79);
eq('2 resmas $158',f.subLinea({precio:f.precioUnitPap(p2,1000),cantidad:1000}),158);
eq('85/300 redondea bien',f.subLinea({precio:85/300,cantidad:300}),85);
// fotocopias del documento: 1 = $1.00, >50 = $0.70
const fc={id:'c',nombre:'Fotocopia',precio:1,stock:999999}; f.set(new Map(),new Map([['c',[{desde:51,pu:0.7}]]]));
eq('1 copia',f.precioUnitPap(fc,1),1); eq('50 copias',f.precioUnitPap(fc,50),1); eq('51 copias',f.precioUnitPap(fc,51),0.7);
eq('100 copias $70',f.subLinea({precio:f.precioUnitPap(fc,100),cantidad:100}),70);
// carrito se re-precia solo
f.setCarrito([{id:'c',cantidad:60,precio:1}],[fc]); f.repriceCarritoPap(); eq('carrito repreciado',f.getCarrito()[0].precio,0.7);
// listón por medios metros
eq('fmtPU',[f.fmtPU(0.7),f.fmtPU(0.158),f.fmtPU(12)],['0.70','0.158','12.00']);
// Cuentahojas
eq('342 hojas',f.contarPorPeso(1573.2,0,4.6),342); eq('con tara',f.contarPorPeso(1600,26.8,4.6),342);
eq('peso 0',f.contarPorPeso(0,0,4.6),0); eq('unitario inválido',f.contarPorPeso(100,0,0),0);
eq('tara mayor que total',f.contarPorPeso(10,50,4.6),0);
// Buscador
const L=[{nombre:'Cartulina azul'},{nombre:'Cartulina Blanca'},{nombre:'Cartón azul grande'},{nombre:'Lápiz Núm. 2',sku:'7501'},{nombre:'Tornillo para carpeta'}];
const b=(t)=>L.filter(p=>f.coincideBusqueda(p,t)).map(p=>p.nombre);
eq('cart azul',b('cart azul'),['Cartulina azul','Cartón azul grande']);
eq('orden libre',b('azul cartul'),['Cartulina azul']);
eq('sin acentos',b('lapiz num'),['Lápiz Núm. 2']); eq('sku',b('7501'),['Lápiz Núm. 2']); eq('nada',b('xyz'),[]);
// tope de 80 en 15,000 artículos
const gran=Array.from({length:15000},(_,i)=>({nombre:'Articulo '+i})); const nota={classList:{remove(){}},textContent:''};
eq('tope 80',f.limitarListaPap(gran,'art',nota).length,80);
console.log(`${ok} ok, ${fail} fallas`); process.exit(fail?1:0);
