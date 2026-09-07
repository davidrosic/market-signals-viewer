// Zaglavlje prikaza: putanja, naslov, i mesto sa desne strane (dugme, pilula).
export default function Glava({ crumb, naslov, desno }) {
  return (
    <div className="head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{naslov}</h1>
      </div>
      {desno && <div className="head-desno">{desno}</div>}
    </div>
  );
}
