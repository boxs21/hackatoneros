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

export const STATES = [inicio, horaPunta, apagon, losCinco, borrados, vagonEscolar, vagonVendedor, final];
