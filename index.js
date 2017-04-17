var Service, Characteristic;
var broadlink = require('broadlinkjs-sm');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-broadlink-sp", "broadlinkSP", broadlinkSP);
}

function broadlinkSP(log, config, api) {
    this.log = log;
    //this.ip = config['ip'];
    this.name = config['name'];
    //this.mac = config['mac'];
    this.powered = false;

    this.service = new Service.Switch(this.name);

    this.service.getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this));

    this.accessoryInformationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Broadlink')
        .setCharacteristic(Characteristic.Model, 'SP')
        .setCharacteristic(Characteristic.SerialNumber, '1.0')
}

broadlinkSP.prototype.getState = function(callback) {
    var self = this
    var b = new broadlink();
    b.discover();

    b.on("deviceReady", (dev) => {
        dev.check_power();
        dev.on("power", (pwr) => {
            self.log("power is on - " + pwr);
            dev.exit();
            if (!pwr) {
                self.powered = false
                return callback(null, false)
            } else {
                self.powered = true
                return callback(null, true)
            }
        });
    });
}

broadlinkSP.prototype.setState = function(state, callback) {
    var self = this
    var b = new broadlink();
    b.discover();

    self.log("set SP state: " + state);
    if (state) {
        if (this.powered) {
            return callback(null, true)
        } else {
            b.on("deviceReady", (dev) => {
                self.log("ON!");
                dev.set_power(true);
                dev.exit();
                this.powered = true;
                return callback(null);
            });
        }
    } else {
        if (this.powered) {
            b.on("deviceReady", (dev) => {
                self.log("OFF!");
                dev.set_power(false);
                dev.exit();
                self.powered = false;
                return callback(null);
            });
        } else {
            return callback(null, false)
        }
    }
}

broadlinkSP.prototype.getServices = function() {
    return [
        this.service,
        this.accessoryInformationService
    ]
}