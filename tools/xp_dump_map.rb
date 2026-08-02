# Dump de um mapa do RPG Maker XP para JSON intermediário (consumido por
# xp2mz_map.py). Extrai: dimensões, 3 camadas de tiles, nome do tileset,
# autotiles, passabilidade e prioridades.
#
# Fontes XP removidas do repo; restaure antes: git checkout 3fb6a23 -- Data Graphics
# Uso:  ruby tools/xp_dump_map.rb <map_id>   (a partir da raiz do repo)
require "json"

# Table do RGSS: _dump = [dim, nx, ny, nz, total].pack("l5") + data.pack("s*")
class Table
  attr_reader :nx, :ny, :nz, :data
  def self._load(s)
    t = allocate
    t.instance_variable_set(:@raw, s)
    dim, nx, ny, nz, total = s[0, 20].unpack("l5")
    t.instance_variable_set(:@nx, nx)
    t.instance_variable_set(:@ny, ny)
    t.instance_variable_set(:@nz, nz)
    t.instance_variable_set(:@data, s[20, total * 2].unpack("s*"))
    t
  end
  def [](x, y = 0, z = 0)
    @data[x + y * @nx + z * @nx * @ny]
  end
end
class Color; def self._load(s); allocate; end; end
class Tone;  def self._load(s); allocate; end; end
module RPG
  class Map; end
  class MapInfo; end
  class Tileset; end
  class Event; class Page; class Condition; end; class Graphic; end; end; end
  class EventCommand; end
  class MoveRoute; end
  class MoveCommand; end
  class AudioFile; end
end

def iv(o, n) o.instance_variable_get(n) end

map_id = (ARGV[0] || "22").to_i
map = Marshal.load(File.binread(format("Data/Map%03d.rxdata", map_id)))
tilesets = Marshal.load(File.binread("Data/Tilesets.rxdata"))
infos = Marshal.load(File.binread("Data/MapInfos.rxdata"))

ts = tilesets[iv(map, :@tileset_id)]
data = iv(map, :@data)
w, h = data.nx, data.ny

layers = (0..2).map do |z|
  (0...h).flat_map { |y| (0...w).map { |x| data[x, y, z] } }
end

passages   = iv(ts, :@passages)
priorities = iv(ts, :@priorities)
max_id = passages.nx

out = {
  "id" => map_id,
  "name" => iv(infos[map_id], :@name),
  "width" => w, "height" => h,
  "tilesetName" => iv(ts, :@tileset_name),
  "autotileNames" => iv(ts, :@autotile_names),
  "layers" => layers,
  "passages" => (0...max_id).map { |i| passages[i] },
  "priorities" => (0...max_id).map { |i| priorities[i] }
}
path = "tools/xp_map_#{map_id}.json"
File.write(path, JSON.generate(out))
puts "OK: #{out['name']} #{w}x#{h}, tileset '#{out['tilesetName']}', " \
     "autotiles #{out['autotileNames'].reject(&:empty?).size} -> #{path}"
