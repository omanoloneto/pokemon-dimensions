# Migração XP → MZ (parcial): exporta o CONTEÚDO dos mapas do projeto RPG Maker
# XP (nomes + diálogos dos eventos) para JSON, para servir de referência ao
# reconstruir as cenas no MZ.
#
# NÃO converte tilesets/layouts (32px→48px) nem a lógica de eventos — isso não é
# automatizável de forma confiável. O objetivo é não perder os textos/estrutura.
#
# Uso (a partir da raiz do repo):  ruby mz/tools/migrate_xp.rb
require "json"

DATA = "Data"
OUT  = "mz/tools/xp_content.json"

# stubs que preservam dados byte-a-byte
class Table; def self._load(s); allocate; end; end
class Color; def self._load(s); allocate; end; end
class Tone;  def self._load(s); allocate; end; end
module RPG
  class MapInfo; end
  class Map; end
  class Event; class Page; class Condition; end; class Graphic; end; end; end
  class EventCommand; end
  class MoveRoute; end
  class MoveCommand; end
  class AudioFile; end
end

def iv(o, name) o.instance_variable_get(name) end

# extrai os textos (Show Text = 101/401) de um mapa desserializado
def extract_events(map)
  events = iv(map, :@events) || {}
  out = []
  events.sort.each do |id, ev|
    texts = []
    (iv(ev, :@pages) || []).each do |pg|
      (iv(pg, :@list) || []).each do |cmd|
        code = iv(cmd, :@code)
        params = iv(cmd, :@parameters) || []
        texts << params[0].to_s if [101, 401].include?(code)
      end
    end
    next if texts.empty?
    out << { "id" => id, "name" => iv(ev, :@name), "x" => iv(ev, :@x), "y" => iv(ev, :@y), "texts" => texts }
  end
  out
end

infos = Marshal.load(File.binread(File.join(DATA, "MapInfos.rxdata")))
maps = []
infos.sort_by { |k, v| iv(v, :@order) || 0 }.each do |id, info|
  file = File.join(DATA, format("Map%03d.rxdata", id))
  next unless File.exist?(file)
  map = Marshal.load(File.binread(file)) rescue next
  maps << {
    "id" => id,
    "name" => iv(info, :@name),
    "events" => extract_events(map)
  }
end

result = {
  "note" => "Conteúdo exportado do projeto XP. Tilesets/layouts NÃO incluídos.",
  "mapCount" => maps.size,
  "maps" => maps
}
File.write(OUT, JSON.pretty_generate(result))
total_events = maps.sum { |m| m["events"].size }
puts "OK: #{maps.size} mapas, #{total_events} eventos com diálogo -> #{OUT} (#{(File.size(OUT) / 1024.0).round} KB)"
