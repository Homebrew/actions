require 'formula'

def git(*args)
  system 'git', *args
  exit $?.exitstatus unless $?.success?
end

puts 'Finding disabled formulae...'

one_year_ago = Date.today << 12
formulae_to_remove = Formula.to_a.select do |formula|
  next false unless formula.disabled?
  next false if formula.disable_date.nil?

  formula.disable_date < one_year_ago
end

puts 'Removing old formulae...'

formulae_to_remove.each { |formula| FileUtils.rm formula.path }

tap_dir = Tap.fetch('homebrew/core').path

out, err, status = Open3.capture3 'git', '-C', tap_dir.to_s, 'status', '--porcelain', '--ignore-submodules=dirty'
raise err unless status.success?

if out.chomp.empty?
  puts 'No formulae removed.'
  exit
end

git '-C', tap_dir.to_s, 'add', '--all'

formulae_to_remove.each do |formula|
  puts "Removed `#{formula.name}`."
  git '-C', tap_dir.to_s, 'commit', formula.path.to_s, '--message', "#{formula.name}: remove formula", '--quiet'
end

puts '::set-output name=formulae-removed::true'
