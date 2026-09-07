// PM2. Pusta se sa dropleta:
//
//   sudo pm2 start /opt/aic/sajt-node/ecosystem.config.cjs
//   sudo pm2 save
//
// LOZINKE OVDE NEMA i ne sme da je bude -- ovaj fajl je u gitu. AIC_DSN cita
// pokreni.sh iz /etc/aic/sajt.env, koji je chmod 640 root:aic.
module.exports = {
  apps: [{
    name: 'aic-sajt',
    script: '/opt/aic/sajt-node/pokreni.sh',
    // Bash, ne node: PM2 podrazumevano svaki `script` gura kroz node.
    interpreter: 'bash',
    cwd: '/opt/aic/sajt-node/server',

    // Jedan proces, ne cluster. `cluster` deli socket kroz node-ov master i
    // ima smisla za CPU-vezan posao; ovaj sajt ceka bazu.
    instances: 1,
    exec_mode: 'fork',

    autorestart: true,
    restart_delay: 3000,
    // Bez ovoga bi greska u konfiguraciji vrtela restart u petlji i pojela
    // jezgro koje dele jos pet sajtova.
    max_restarts: 10,
    min_uptime: '30s',
    // Sajt trazi ~60 MB. 250 MB hvata curenje a ne dira normalan rad.
    max_memory_restart: '250M',

    out_file: '/var/log/aic/izlaz.log',
    error_file: '/var/log/aic/greska.log',
    merge_logs: true,
    time: true,
    env: { NODE_ENV: 'production' },
  }],
};
