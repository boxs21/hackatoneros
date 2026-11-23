// Orden oficial de los momentos. Es también el orden de las teclas 1–8
// del modo demo y de la tabla del README. No cambiar sin avisar.
import inicio from './inicio.js';
import horaPunta from './horaPunta.js';
import apagon from './apagon.js';
import losCinco from './losCinco.js';
import borrados from './borrados.js';
import vagonEscolar from './vagonEscolar.js';
import vagonVendedor from './vagonVendedor.js';
import final from './final.js';
import vagonOficinista from './vagonOficinista.js'; // extra (Camilo): al final para no mover las teclas 1–8
import despertar from './despertar.js'; // extra (Andy): final abierto después del derrumbe; al final por lo mismo

export const STATES = [inicio, horaPunta, apagon, losCinco, borrados, vagonEscolar, vagonVendedor, final, vagonOficinista, despertar];
