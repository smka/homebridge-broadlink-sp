var Service, Characteristic;
var broadlink = require('broadlinkjs-sm');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-broadlink-sp", "broadlinkSP", broadlinkSP);
}

function broadlinkSP(log, config, api) {
    this.log = log;
    this.ip = config['ip'];
    this.name = config['name'];
    this.mac = config['mac'];
    this.devtype = config['devtype'];
    this.powered = null;
    this.addr = null;

    if (!this.ip && !this.mac) throw new Error("You must provide a config value for 'ip' or 'mac'.");

    // MAC string to MAC buffer
    this.mac_buff = function(mac) {
        var mb = new Buffer(6);
        if (mac) {
            var values = mac.split(':');
            if (!values || values.length !== 6) {
                throw new Error('Invalid MAC [' + mac + ']; should follow pattern ##:##:##:##:##:##');
            }
            for (var i = 0; i < values.length; ++i) {
                var tmpByte = parseInt(values[i], 16);
                mb.writeUInt8(tmpByte, i);
            }
        } else {
            //this.log("MAC address emtpy, using IP: " + this.ip);
        }
        return mb;
    }

    if (this.ip && this.mac && this.devtype) {
        this.addr = {'address': this.ip, port: 80};            
    }

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
    if (this.addr) {
        var dev = b.genDevice(this.devtype, this.addr, this.mac);
        dev.on("power", (pwr) => {
            self.log("power is " + (pwr ? "ON" : "OFF"));
            dev.exit();
            self.powered = pwr;
            return callback(null, pwr);
        });
        dev.on("deviceReady", () => {
            self.log("device ready");
            dev.check_power();
        });
        dev.auth();    
    } else {
        b.discover();
        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                dev.check_power();
                dev.on("power", (pwr) => {
                    self.log("power is on - " + pwr);
                    dev.exit();
                    if (!pwr) {
                        self.powered = false;
                        return callback(null, false);
                    } else {
                        self.powered = true;
                        return callback(null, true);
                    }
                });
            } else {
                dev.exit();
            }
        });
    }
}

broadlinkSP.prototype.setState = function(state, callback) {
    var self = this
    self.log("set SP state: " + state);
    var b = new broadlink();
    if (this.addr) {
        if (state == this.powered && this.powered != null) {
            return callback(null);
        } else {
            var dev = b.genDevice(this.devtype, this.addr, this.mac);
            dev.on("deviceReady", () => {
                self.log("setting to " + (state ? "ON" : "OFF"));
                dev.set_power(state);
                dev.exit()
                this.powered = state;
                return callback(null);
            });
            dev.auth();
        }
    } else {
        b.discover();
        if (state) {
            if (this.powered) {
                return callback(null, true)
            } else {
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log("ON!");
                        dev.set_power(true);
                        dev.exit();
                        this.powered = true;
                        return callback(null);
                    } else {
                        dev.exit();
                    }
                });
            }
        } else {
            if (this.powered) {
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log("OFF!");
                        dev.set_power(false);
                        dev.exit();
                        self.powered = false;
                        return callback(null);
                    } else {
                        dev.exit();
                    }
                });
            } else {
                return callback(null, false)
            }
        }        
    }
}

broadlinkSP.prototype.getServices = function() {
    return [
        this.service,
        this.accessoryInformationService
    ]
}