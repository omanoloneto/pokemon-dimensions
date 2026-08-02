# Compilador: PBS/pokemon.txt (Pokémon Essentials / RPG Maker XP)
#   -> data/Pokemon.json (consumível pelo RPG Maker MZ)
#
# Fontes XP removidas do repo; restaure antes: git checkout 3fb6a23 -- PBS
# Uso:  ruby tools/compile_pbs.rb [caminho/pokemon.txt] [saida.json]
# Padrao: le "PBS/pokemon.txt", escreve "data/Pokemon.json"
require "json"

src = ARGV[0] || "PBS/pokemon.txt"
out = ARGV[1] || "data/Pokemon.json"

raise "PBS nao encontrado: #{src}" unless File.exist?(src)

# Ordem do BaseStats no Essentials v15/16: HP, ATK, DEF, SPEED, SP.ATK, SP.DEF
STAT_KEYS = %w[hp atk def spe spa spd].freeze

species = []
current = nil

File.foreach(src, encoding: "bom|utf-8") do |raw|
  line = raw.rstrip
  next if line.empty?

  if (m = line.match(/^\[(\d+)\]/))
    species << current if current
    current = { "id" => m[1].to_i }
    next
  end
  next unless current
  key, _, val = line.partition("=")
  key = key.strip
  val = val.strip

  case key
  when "Name"          then current["name"] = val
  when "InternalName"  then current["internalName"] = val
  when "Type1"         then current["type1"] = val
  when "Type2"         then current["type2"] = val
  when "Kind"          then current["category"] = val   # ex.: "Seed"
  when "Pokedex"       then current["entry"] = val
  when "Height"        then current["height"] = val.to_f # metros
  when "Weight"        then current["weight"] = val.to_f # kg
  when "Color"         then current["color"] = val
  when "Habitat"       then current["habitat"] = val
  when "GenderRate"    then current["genderRate"] = val
  when "BaseStats"
    nums = val.split(",").map(&:to_i)
    current["stats"] = STAT_KEYS.each_with_index.to_h { |k, i| [k, nums[i] || 0] }
  when "RegionalNumbers"
    current["regionalNumbers"] = val.split(",").map(&:to_i)
  end
end
species << current if current

# Indice 0 vazio para casar numero da Pokedex com indice do array ($dataPokemon[1] = #1)
table = [nil] + species

File.write(out, JSON.pretty_generate(table))
puts "OK: #{species.size} especies -> #{out} (#{(File.size(out) / 1024.0).round} KB)"
