const osUtils = require('os-utils');

module.exports = class System {

  constructor(actualizeCpuMs = 1000) {
    if (typeof actualizeCpuMs !== 'number' || actualizeCpuMs <= 0) {
      throw new Error('Invalid actualizeCpuMs param');
    }

    this.cpu = 0;

    const actualizeCpu = () => {
      osUtils.cpuUsage((usage) => {
        this.cpu = Math.round(usage * 100);
        setTimeout(actualizeCpu, actualizeCpuMs);
      });
    };

    actualizeCpu();
  }

  getState() {
    const memory = Math.round(osUtils.totalmem() - osUtils.freemem());

    const uptime = osUtils.sysUptime();

    const uptimeStart = new Date();
    uptimeStart.setSeconds(uptimeStart.getSeconds() - uptime);

    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    return {
      cpu: this.cpu,
      memory,
      uptime,
      uptimeStart,
      uptimeDays,
      uptimeHours,
      uptimeMinutes
    };
  }

};
